#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs as parseNodeArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const SEARCH_OPPORTUNITY_HEADERS = Object.freeze([
  'Opportunity ID',
  'Date Found',
  'Last Seen',
  'Source',
  'Search Query',
  'Existing URL/Post',
  'Current Window Start',
  'Current Window End',
  'Previous Window Start',
  'Previous Window End',
  'Impressions',
  'Clicks',
  'CTR',
  'Position',
  'Intent',
  'Suggested Content',
  'Content Cluster',
  'Priority Score',
  'Status',
  'Draft Link',
  'Published URL',
  'Last Reviewed',
  'Approval Notes',
]);

export const PERFORMANCE_SNAPSHOT_HEADERS = Object.freeze([
  'Snapshot ID',
  'Snapshot Date',
  'Source',
  'Window Start',
  'Window End',
  'Search Query',
  'URL/Post',
  'Impressions',
  'Clicks',
  'CTR',
  'Position',
  'Imported At',
  'Import Method',
]);

const HEADER_ALIASES = Object.freeze({
  query: [
    'query',
    'queries',
    'top query',
    'top queries',
    'search query',
    'search queries',
    'keyword',
  ],
  page: [
    'page',
    'pages',
    'top page',
    'top pages',
    'landing page',
    'landing pages',
    'url',
    'url post',
    'existing url post',
  ],
  clicks: ['click', 'clicks'],
  impressions: ['impression', 'impressions'],
  ctr: ['ctr', 'click through rate', 'clickthrough rate'],
  position: ['position', 'average position', 'avg position'],
});

const REQUIRED_FIELDS = Object.freeze([
  'query',
  'page',
  'clicks',
  'impressions',
  'position',
]);

const DEFAULT_PROFILES = Object.freeze({
  'new-site': Object.freeze({
    min_impressions: 10,
    max_clicks: 2,
    min_position: 4,
    max_position: 30,
    max_ctr: null,
  }),
  'established-site': Object.freeze({
    min_impressions: 50,
    max_clicks: null,
    min_position: 4,
    max_position: 20,
    max_ctr: 'site-average',
  }),
});

const CONFIG_KEYS = new Set([
  'min_impressions',
  'max_clicks',
  'min_position',
  'max_position',
  'max_ctr',
]);

export class ProcessorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProcessorError';
  }
}

function normaliseHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collapseWhitespace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function canonicalQuery(value) {
  return collapseWhitespace(value).toLowerCase();
}

function canonicalPage(value) {
  const cleaned = String(value ?? '').trim();
  try {
    const url = new URL(cleaned);
    url.hash = '';
    return url.toString();
  } catch {
    return cleaned;
  }
}

function aggregateKey(query, page) {
  return `${canonicalQuery(query)}\u0000${canonicalPage(page)}`;
}

/** Parse RFC 4180-style CSV, including escaped quotes and embedded newlines. */
export function parseCsv(text) {
  let input = String(text ?? '');
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new ProcessorError('CSV ends inside a quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  while (rows.length > 0 && rows.at(-1).every((cell) => cell === '')) rows.pop();
  if (rows.length === 0) throw new ProcessorError('CSV is empty.');

  return { headers: rows[0], rows: rows.slice(1) };
}

function resolveHeaders(headers, sourceName) {
  const normalised = headers.map(normaliseHeader);
  const resolved = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const accepted = new Set(aliases.map(normaliseHeader));
    const index = normalised.findIndex((header) => accepted.has(header));
    if (index >= 0) resolved[field] = index;
  }

  const missing = REQUIRED_FIELDS.filter((field) => resolved[field] === undefined);
  if (missing.length > 0) {
    throw new ProcessorError(
      `${sourceName} is missing required GSC column(s): ${missing.join(', ')}. ` +
        `Found: ${headers.join(', ')}`,
    );
  }
  return resolved;
}

function parseCount(raw, label, rowNumber, sourceName) {
  const value = String(raw ?? '').trim().replace(/[\s,]/g, '');
  if (!/^\d+(?:\.0+)?$/.test(value)) {
    throw new ProcessorError(
      `${sourceName} row ${rowNumber} has an invalid ${label}: ${JSON.stringify(raw ?? '')}`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ProcessorError(`${sourceName} row ${rowNumber} has an unsafe ${label}.`);
  }
  return parsed;
}

function parsePosition(raw, rowNumber, sourceName) {
  const value = String(raw ?? '').trim().replace(/,/g, '');
  const parsed = Number(value);
  if (value === '' || !Number.isFinite(parsed) || parsed < 0) {
    throw new ProcessorError(
      `${sourceName} row ${rowNumber} has an invalid position: ${JSON.stringify(raw ?? '')}`,
    );
  }
  return parsed;
}

/** Aggregate duplicate query/page rows and recompute CTR and weighted position. */
export function aggregateGscCsv(text, sourceName = 'GSC export') {
  const parsed = parseCsv(text);
  const columns = resolveHeaders(parsed.headers, sourceName);
  const accumulators = new Map();

  parsed.rows.forEach((cells, offset) => {
    const rowNumber = offset + 2;
    if (cells.every((cell) => String(cell ?? '').trim() === '')) return;

    const query = collapseWhitespace(cells[columns.query]);
    const page = String(cells[columns.page] ?? '').trim();
    if (!query || !page) {
      throw new ProcessorError(
        `${sourceName} row ${rowNumber} must contain both a query and a page/post.`,
      );
    }

    const clicks = parseCount(cells[columns.clicks], 'click count', rowNumber, sourceName);
    const impressions = parseCount(
      cells[columns.impressions],
      'impression count',
      rowNumber,
      sourceName,
    );
    const position = parsePosition(cells[columns.position], rowNumber, sourceName);
    const key = aggregateKey(query, page);
    let accumulator = accumulators.get(key);
    if (!accumulator) {
      accumulator = {
        key,
        query,
        page,
        clicks: 0,
        impressions: 0,
        weightedPosition: 0,
        positionWeight: 0,
        fallbackPosition: 0,
        rowCount: 0,
      };
      accumulators.set(key, accumulator);
    }

    accumulator.clicks += clicks;
    accumulator.impressions += impressions;
    accumulator.weightedPosition += position * impressions;
    accumulator.positionWeight += impressions;
    accumulator.fallbackPosition += position;
    accumulator.rowCount += 1;
  });

  return [...accumulators.values()]
    .map((item) => ({
      key: item.key,
      query: item.query,
      page: item.page,
      impressions: item.impressions,
      clicks: item.clicks,
      ctr: item.impressions > 0 ? item.clicks / item.impressions : 0,
      position:
        item.positionWeight > 0
          ? item.weightedPosition / item.positionWeight
          : item.fallbackPosition / item.rowCount,
    }))
    .sort((left, right) =>
      left.query.localeCompare(right.query) || left.page.localeCompare(right.page),
    );
}

/** Compare all current rows to the same query/page in the preceding export. */
export function comparePeriods(currentRows, previousRows) {
  const previousByKey = new Map(previousRows.map((row) => [row.key, row]));
  return currentRows.map((current) => {
    const previous = previousByKey.get(current.key) ?? null;
    return {
      key: current.key,
      current,
      previous,
      impressionsDelta: current.impressions - (previous?.impressions ?? 0),
      clicksDelta: current.clicks - (previous?.clicks ?? 0),
      ctrDelta: previous ? current.ctr - previous.ctr : null,
      positionDelta: previous ? current.position - previous.position : null,
    };
  });
}

function stableId(prefix, parts) {
  const canonical = parts.map((part) => String(part)).join('\u001f');
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16);
  return `${prefix}-${digest.toUpperCase()}`;
}

export function makeOpportunityId(source, query, page) {
  return stableId('OPP', [
    collapseWhitespace(source).toLowerCase(),
    canonicalQuery(query),
    canonicalPage(page),
  ]);
}

export function makeSnapshotId(source, windowStart, windowEnd, query, page) {
  return stableId('SNP', [
    collapseWhitespace(source).toLowerCase(),
    windowStart,
    windowEnd,
    canonicalQuery(query),
    canonicalPage(page),
  ]);
}

function parseNonnegativeNumber(value, name) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    throw new ProcessorError(`${name} must be a non-negative number.`);
  }
  const parsed = Number(value);
  if (value === '' || !Number.isFinite(parsed) || parsed < 0) {
    throw new ProcessorError(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function parseNonnegativeInteger(value, name, allowNull = false) {
  if (allowNull && (value === null || String(value).toLowerCase() === 'none')) return null;
  const parsed = parseNonnegativeNumber(value, name);
  if (!Number.isSafeInteger(parsed)) throw new ProcessorError(`${name} must be an integer.`);
  return parsed;
}

function parseCtrSetting(value) {
  if (value === null || String(value).trim().toLowerCase() === 'none') {
    return { maxCtr: null, useSiteAverageCtr: false };
  }
  if (String(value).trim().toLowerCase() === 'site-average') {
    return { maxCtr: null, useSiteAverageCtr: true };
  }

  const stringValue = String(value).trim();
  const hasPercentSign = stringValue.endsWith('%');
  const numericText = hasPercentSign ? stringValue.slice(0, -1) : stringValue;
  let parsed = Number(numericText);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ProcessorError('max_ctr/--max-ctr must be a percentage, ratio, site-average, or none.');
  }
  if (hasPercentSign || parsed > 1) parsed /= 100;
  if (parsed > 1) throw new ProcessorError('max_ctr/--max-ctr cannot exceed 100%.');
  return { maxCtr: parsed, useSiteAverageCtr: false };
}

/** Resolve defaults, an optional JSON profile, then command-line overrides. */
export function resolveThresholds({ profile = 'new-site', config = {}, overrides = {} } = {}) {
  if (!DEFAULT_PROFILES[profile]) {
    throw new ProcessorError('profile must be new-site or established-site.');
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new ProcessorError('Threshold configuration must be a JSON object.');
  }

  const configured = config[profile] ?? {};
  if (configured === null || typeof configured !== 'object' || Array.isArray(configured)) {
    throw new ProcessorError(`Configuration for ${profile} must be an object.`);
  }
  const unknown = Object.keys(configured).filter((key) => !CONFIG_KEYS.has(key));
  if (unknown.length > 0) {
    throw new ProcessorError(`Unknown ${profile} threshold key(s): ${unknown.join(', ')}.`);
  }

  const merged = { ...DEFAULT_PROFILES[profile], ...configured };
  const commandLineMap = {
    minImpressions: 'min_impressions',
    maxClicks: 'max_clicks',
    minPosition: 'min_position',
    maxPosition: 'max_position',
    maxCtr: 'max_ctr',
  };
  for (const [option, key] of Object.entries(commandLineMap)) {
    if (overrides[option] !== undefined) merged[key] = overrides[option];
  }

  const minImpressions = parseNonnegativeInteger(
    merged.min_impressions,
    'min_impressions/--min-impressions',
  );
  const maxClicks = parseNonnegativeInteger(
    merged.max_clicks,
    'max_clicks/--max-clicks',
    true,
  );
  const minPosition = parseNonnegativeNumber(
    merged.min_position,
    'min_position/--min-position',
  );
  const maxPosition = parseNonnegativeNumber(
    merged.max_position,
    'max_position/--max-position',
  );
  if (minPosition > maxPosition) {
    throw new ProcessorError('Minimum position cannot exceed maximum position.');
  }
  const ctr = parseCtrSetting(merged.max_ctr);

  return {
    profile,
    minImpressions,
    maxClicks,
    minPosition,
    maxPosition,
    ...ctr,
  };
}

export function calculateSiteAverageCtr(rows) {
  const totals = rows.reduce(
    (sum, row) => ({
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks,
    }),
    { impressions: 0, clicks: 0 },
  );
  return totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
}

export function selectOpportunities(comparisons, thresholds, siteAverageCtr) {
  const effectiveMaxCtr = thresholds.useSiteAverageCtr
    ? siteAverageCtr
    : thresholds.maxCtr;

  const selected = comparisons.filter(({ current }) => {
    if (current.impressions < thresholds.minImpressions) return false;
    if (thresholds.maxClicks !== null && current.clicks > thresholds.maxClicks) return false;
    if (current.position < thresholds.minPosition || current.position > thresholds.maxPosition) {
      return false;
    }
    if (effectiveMaxCtr !== null && current.ctr >= effectiveMaxCtr) return false;
    return true;
  });

  return { selected, effectiveMaxCtr };
}

function derivePriority(comparison, thresholds) {
  const highVolume = comparison.current.impressions >= thresholds.minImpressions * 2;
  if (!comparison.previous) return highVolume ? 'High' : 'Medium';
  if (
    highVolume &&
    comparison.impressionsDelta >= 0 &&
    (comparison.ctrDelta <= 0 || comparison.clicksDelta <= 0)
  ) {
    return 'High';
  }
  if (comparison.impressionsDelta < 0 && comparison.ctrDelta > 0) return 'Low';
  return 'Medium';
}

function rounded(value) {
  return Number(Number(value).toFixed(6));
}

function buildOpportunityRows({
  comparisons,
  thresholds,
  source,
  currentWindow,
  previousWindow,
  runDate,
}) {
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  return comparisons
    .map((comparison) => ({ comparison, priority: derivePriority(comparison, thresholds) }))
    .sort(
      (left, right) =>
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        right.comparison.current.impressions - left.comparison.current.impressions ||
        left.comparison.current.position - right.comparison.current.position ||
        left.comparison.current.query.localeCompare(right.comparison.current.query) ||
        left.comparison.current.page.localeCompare(right.comparison.current.page),
    )
    .map(({ comparison, priority }) => ({
      'Opportunity ID': makeOpportunityId(
        source,
        comparison.current.query,
        comparison.current.page,
      ),
      'Date Found': runDate,
      'Last Seen': runDate,
      Source: source,
      'Search Query': comparison.current.query,
      'Existing URL/Post': comparison.current.page,
      'Current Window Start': currentWindow.start,
      'Current Window End': currentWindow.end,
      'Previous Window Start': previousWindow.start,
      'Previous Window End': previousWindow.end,
      Impressions: comparison.current.impressions,
      Clicks: comparison.current.clicks,
      CTR: rounded(comparison.current.ctr),
      Position: rounded(comparison.current.position),
      Intent: '',
      'Suggested Content': '',
      'Content Cluster': '',
      'Priority Score': priority,
      Status: 'New',
      'Draft Link': '',
      'Published URL': '',
      'Last Reviewed': '',
      'Approval Notes': '',
    }));
}

function buildSnapshotRows({ rows, source, window, snapshotDate, importedAt }) {
  return rows.map((row) => ({
    'Snapshot ID': makeSnapshotId(source, window.start, window.end, row.query, row.page),
    'Snapshot Date': snapshotDate,
    Source: source,
    'Window Start': window.start,
    'Window End': window.end,
    'Search Query': row.query,
    'URL/Post': row.page,
    Impressions: row.impressions,
    Clicks: row.clicks,
    CTR: rounded(row.ctr),
    Position: rounded(row.position),
    'Imported At': importedAt,
    'Import Method': 'GSC CSV Export',
  }));
}

function escapeCsv(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function serialiseCsv(headers, rows) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  return `${lines.join('\n')}\n`;
}

async function writeCsvAtomic(path, headers, rows) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = resolve(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, serialiseCsv(headers, rows), 'utf8');
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

function parseIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    throw new ProcessorError(`${label} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new ProcessorError(`${label} is not a valid calendar date.`);
  }
  return date;
}

function addDays(value, days) {
  const date = parseIsoDate(value, 'date');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inclusiveDays(start, end) {
  return (parseIsoDate(end, 'window end') - parseIsoDate(start, 'window start')) / 86_400_000 + 1;
}

export function resolveWindows({ currentEnd, currentStart, previousEnd, previousStart }) {
  parseIsoDate(currentEnd, '--current-end');
  const current = {
    end: currentEnd,
    start: currentStart ?? addDays(currentEnd, -27),
  };
  const previous = {
    end: previousEnd ?? addDays(current.start, -1),
    start: previousStart ?? addDays(previousEnd ?? addDays(current.start, -1), -27),
  };

  parseIsoDate(current.start, '--current-start');
  parseIsoDate(previous.start, '--previous-start');
  parseIsoDate(previous.end, '--previous-end');
  if (inclusiveDays(current.start, current.end) !== 28) {
    throw new ProcessorError('The current export window must contain exactly 28 days.');
  }
  if (inclusiveDays(previous.start, previous.end) !== 28) {
    throw new ProcessorError('The previous export window must contain exactly 28 days.');
  }
  if (addDays(previous.end, 1) !== current.start) {
    throw new ProcessorError('The previous window must immediately precede the current window.');
  }
  return { current, previous };
}

/** Read, aggregate, compare, filter, and write the two sheet-ready CSV files. */
export async function processExports(options) {
  const currentPath = resolve(options.currentPath);
  const previousPath = resolve(options.previousPath);
  if (currentPath === previousPath) {
    throw new ProcessorError('Current and previous exports must be different files.');
  }
  const outputDir = resolve(options.outputDir ?? '.');
  const opportunitiesPath = resolve(outputDir, 'search-opportunities.csv');
  const snapshotsPath = resolve(outputDir, 'performance-snapshots.csv');
  if ([opportunitiesPath, snapshotsPath].includes(currentPath)) {
    throw new ProcessorError('The current input path conflicts with an output path.');
  }
  if ([opportunitiesPath, snapshotsPath].includes(previousPath)) {
    throw new ProcessorError('The previous input path conflicts with an output path.');
  }

  const source = collapseWhitespace(options.source ?? 'Website');
  if (!source) throw new ProcessorError('Source cannot be blank.');
  const runDate = options.runDate ?? new Date().toISOString().slice(0, 10);
  parseIsoDate(runDate, '--run-date');
  const importedAt = options.importedAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (Number.isNaN(Date.parse(importedAt))) {
    throw new ProcessorError('importedAt must be an ISO date-time.');
  }

  const [currentText, previousText] = await Promise.all([
    readFile(currentPath, 'utf8'),
    readFile(previousPath, 'utf8'),
  ]);
  const currentRows = aggregateGscCsv(currentText, basename(currentPath));
  const previousRows = aggregateGscCsv(previousText, basename(previousPath));
  const comparisons = comparePeriods(currentRows, previousRows);

  let config = options.config ?? {};
  if (options.configPath) {
    try {
      config = JSON.parse(await readFile(resolve(options.configPath), 'utf8'));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ProcessorError(`Threshold configuration is invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }
  const thresholds = resolveThresholds({
    profile: options.profile ?? 'new-site',
    config,
    overrides: options.overrides ?? {},
  });
  const siteAverageCtr = calculateSiteAverageCtr(currentRows);
  const selection = selectOpportunities(comparisons, thresholds, siteAverageCtr);
  const opportunityRows = buildOpportunityRows({
    comparisons: selection.selected,
    thresholds,
    source,
    currentWindow: options.windows.current,
    previousWindow: options.windows.previous,
    runDate,
  });

  let snapshotRows = buildSnapshotRows({
    rows: currentRows,
    source,
    window: options.windows.current,
    snapshotDate: runDate,
    importedAt,
  });
  if (options.includePreviousSnapshot) {
    snapshotRows = [
      ...buildSnapshotRows({
        rows: previousRows,
        source,
        window: options.windows.previous,
        snapshotDate: runDate,
        importedAt,
      }),
      ...snapshotRows,
    ];
  }

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeCsvAtomic(opportunitiesPath, SEARCH_OPPORTUNITY_HEADERS, opportunityRows),
    writeCsvAtomic(snapshotsPath, PERFORMANCE_SNAPSHOT_HEADERS, snapshotRows),
  ]);

  return {
    opportunitiesPath,
    snapshotsPath,
    currentRowCount: currentRows.length,
    previousRowCount: previousRows.length,
    comparisonCount: comparisons.length,
    opportunityCount: opportunityRows.length,
    snapshotCount: snapshotRows.length,
    siteAverageCtr,
    effectiveMaxCtr: selection.effectiveMaxCtr,
    thresholds,
  };
}

const HELP = `Credential-free Google Search Console CSV processor

Usage:
  node gsc-processor.mjs CURRENT.csv PREVIOUS.csv --current-end YYYY-MM-DD [options]

Required:
  CURRENT.csv / PREVIOUS.csv       Consecutive 28-day Query + Page exports
  --current-end YYYY-MM-DD         Last date represented by CURRENT.csv

Options:
  --profile NAME                   new-site (default) or established-site
  --output-dir DIR                 Output directory (default: current directory)
  --source NAME                    Sheet source label (default: Website)
  --run-date YYYY-MM-DD            Discovery/snapshot date (default: today)
  --current-start YYYY-MM-DD       Derived from --current-end when omitted
  --previous-start YYYY-MM-DD      Derived from the current window when omitted
  --previous-end YYYY-MM-DD        Derived from the current window when omitted
  --config FILE                    JSON threshold configuration
  --min-impressions N              Override the selected profile
  --max-clicks N|none              Override/disable its click ceiling
  --min-position N                 Override the minimum average position
  --max-position N                 Override the maximum average position
  --max-ctr N|N%|site-average|none Override/disable its CTR ceiling
  --include-previous-snapshot      Include both windows for an initial backfill
  --help                           Show this help
`;

export function parseCli(argv) {
  let parsed;
  try {
    parsed = parseNodeArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        profile: { type: 'string' },
        'output-dir': { type: 'string' },
        source: { type: 'string' },
        'run-date': { type: 'string' },
        'current-start': { type: 'string' },
        'current-end': { type: 'string' },
        'previous-start': { type: 'string' },
        'previous-end': { type: 'string' },
        config: { type: 'string' },
        'min-impressions': { type: 'string' },
        'max-clicks': { type: 'string' },
        'min-position': { type: 'string' },
        'max-position': { type: 'string' },
        'max-ctr': { type: 'string' },
        'include-previous-snapshot': { type: 'boolean' },
      },
    });
  } catch (error) {
    throw new ProcessorError(error.message);
  }

  if (parsed.values.help) return { help: true };
  if (parsed.positionals.length !== 2) {
    throw new ProcessorError('Provide exactly two CSV files: CURRENT.csv and PREVIOUS.csv.');
  }
  if (!parsed.values['current-end']) {
    throw new ProcessorError('--current-end is required because GSC CSV exports omit window dates.');
  }

  const profile = parsed.values.profile ?? 'new-site';
  if (!DEFAULT_PROFILES[profile]) {
    throw new ProcessorError('--profile must be new-site or established-site.');
  }
  const windows = resolveWindows({
    currentEnd: parsed.values['current-end'],
    currentStart: parsed.values['current-start'],
    previousEnd: parsed.values['previous-end'],
    previousStart: parsed.values['previous-start'],
  });
  const overrides = {};
  for (const [option, key] of [
    ['min-impressions', 'minImpressions'],
    ['max-clicks', 'maxClicks'],
    ['min-position', 'minPosition'],
    ['max-position', 'maxPosition'],
    ['max-ctr', 'maxCtr'],
  ]) {
    if (parsed.values[option] !== undefined) overrides[key] = parsed.values[option];
  }

  return {
    currentPath: parsed.positionals[0],
    previousPath: parsed.positionals[1],
    outputDir: parsed.values['output-dir'] ?? '.',
    source: parsed.values.source ?? 'Website',
    runDate: parsed.values['run-date'],
    profile,
    configPath: parsed.values.config,
    includePreviousSnapshot: parsed.values['include-previous-snapshot'] ?? false,
    windows,
    overrides,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCli(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const result = await processExports(options);
  process.stdout.write(
    [
      `Aggregated ${result.currentRowCount} current and ${result.previousRowCount} previous query/page rows.`,
      `Computed ${result.comparisonCount} current-vs-previous metric deltas.`,
      `Wrote ${result.opportunityCount} New opportunities to ${result.opportunitiesPath}`,
      `Wrote ${result.snapshotCount} append-ready snapshots to ${result.snapshotsPath}`,
      'No content was approved, drafted, or published.',
    ].join('\n') + '\n',
  );
  return 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 2;
  });
}
