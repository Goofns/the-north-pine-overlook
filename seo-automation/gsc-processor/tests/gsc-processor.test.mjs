import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  PERFORMANCE_SNAPSHOT_HEADERS,
  SEARCH_OPPORTUNITY_HEADERS,
  ProcessorError,
  aggregateGscCsv,
  comparePeriods,
  makeOpportunityId,
  parseCsv,
  processExports,
  resolveThresholds,
  resolveWindows,
  selectOpportunities,
} from '../gsc-processor.mjs';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const currentFixture = join(root, 'fixtures', 'current-28-days.csv');
const previousFixture = join(root, 'fixtures', 'previous-28-days.csv');
const windows = resolveWindows({ currentEnd: '2026-07-12' });

async function fixtureRows() {
  const [currentText, previousText] = await Promise.all([
    readFile(currentFixture, 'utf8'),
    readFile(previousFixture, 'utf8'),
  ]);
  return {
    current: aggregateGscCsv(currentText, 'current fixture'),
    previous: aggregateGscCsv(previousText, 'previous fixture'),
  };
}

test('CSV parser handles a BOM, commas, escaped quotes, and embedded newlines', () => {
  const parsed = parseCsv('\uFEFFQuery,Page\r\n"cabins, Bailey","https://example.com/a"\r\n"say ""hi""","line\n2"\r\n');
  assert.deepEqual(parsed.headers, ['Query', 'Page']);
  assert.deepEqual(parsed.rows, [
    ['cabins, Bailey', 'https://example.com/a'],
    ['say "hi"', 'line\n2'],
  ]);
});

test('typical GSC header capitalization is accepted and query/page duplicates aggregate', async () => {
  const { current } = await fixtureRows();
  assert.equal(current.length, 5);
  const bailey = current.find((row) => row.query === 'Bailey cabin');
  assert.ok(bailey);
  assert.equal(bailey.impressions, 60);
  assert.equal(bailey.clicks, 2);
  assert.ok(Math.abs(bailey.ctr - 2 / 60) < 1e-12);
  assert.ok(Math.abs(bailey.position - 520 / 60) < 1e-12);
});

test('comparison computes deltas and opportunity IDs remain stable across runs', async () => {
  const { current, previous } = await fixtureRows();
  const comparisons = comparePeriods(current, previous);
  const bailey = comparisons.find((row) => row.current.query === 'Bailey cabin');
  assert.equal(bailey.impressionsDelta, 30);
  assert.equal(bailey.clicksDelta, -1);
  assert.ok(bailey.ctrDelta < 0);
  assert.ok(bailey.positionDelta < 0);

  assert.equal(
    makeOpportunityId(' Website ', ' BAILEY   CABIN ', 'HTTPS://northpineoverlook.com/#fragment'),
    makeOpportunityId('website', 'bailey cabin', 'https://northpineoverlook.com/'),
  );
  assert.notEqual(
    makeOpportunityId('website', 'bailey cabin', 'https://northpineoverlook.com/rates.html'),
    makeOpportunityId('website', 'bailey cabin', 'https://northpineoverlook.com/'),
  );
  assert.notEqual(
    makeOpportunityId('website', 'bailey cabin', 'https://northpineoverlook.com/Page'),
    makeOpportunityId('website', 'bailey cabin', 'https://northpineoverlook.com/page'),
  );
});

test('new-site and established-site defaults apply their documented thresholds', async () => {
  const { current, previous } = await fixtureRows();
  const comparisons = comparePeriods(current, previous);
  const siteAverage = current.reduce((sum, row) => sum + row.clicks, 0) /
    current.reduce((sum, row) => sum + row.impressions, 0);

  const newSite = resolveThresholds({ profile: 'new-site' });
  const newSelection = selectOpportunities(comparisons, newSite, siteAverage);
  assert.deepEqual(
    newSelection.selected.map((item) => item.current.query).sort(),
    ['Bailey cabin', 'hiking near Bailey'],
  );

  const established = resolveThresholds({ profile: 'established-site' });
  const establishedSelection = selectOpportunities(comparisons, established, siteAverage);
  assert.deepEqual(establishedSelection.selected.map((item) => item.current.query), ['Bailey cabin']);
  assert.equal(establishedSelection.effectiveMaxCtr, siteAverage);
});

test('JSON-style settings and command-line overrides are configurable and validated', () => {
  const thresholds = resolveThresholds({
    profile: 'new-site',
    config: {
      'new-site': {
        min_impressions: 25,
        max_clicks: null,
        min_position: 2,
        max_position: 40,
        max_ctr: '3%',
      },
    },
    overrides: { minImpressions: '30', maxCtr: 'site-average' },
  });
  assert.equal(thresholds.minImpressions, 30);
  assert.equal(thresholds.maxClicks, null);
  assert.equal(thresholds.useSiteAverageCtr, true);
  assert.throws(
    () => resolveThresholds({ profile: 'new-site', config: { 'new-site': { surprise: 1 } } }),
    ProcessorError,
  );
});

test('processor writes exact sheet schemas, only New statuses, and current snapshots by default', async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), 'north-pine-gsc-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const result = await processExports({
    currentPath: currentFixture,
    previousPath: previousFixture,
    outputDir,
    profile: 'new-site',
    source: 'Website',
    runDate: '2026-07-13',
    importedAt: '2026-07-13T12:00:00Z',
    windows,
  });
  assert.equal(result.opportunityCount, 2);
  assert.equal(result.snapshotCount, 5);

  const opportunities = parseCsv(await readFile(result.opportunitiesPath, 'utf8'));
  const snapshots = parseCsv(await readFile(result.snapshotsPath, 'utf8'));
  assert.deepEqual(opportunities.headers, [...SEARCH_OPPORTUNITY_HEADERS]);
  assert.deepEqual(snapshots.headers, [...PERFORMANCE_SNAPSHOT_HEADERS]);
  assert.equal(opportunities.rows.length, 2);
  assert.equal(snapshots.rows.length, 5);

  const status = opportunities.headers.indexOf('Status');
  const draft = opportunities.headers.indexOf('Draft Link');
  const published = opportunities.headers.indexOf('Published URL');
  const approval = opportunities.headers.indexOf('Approval Notes');
  for (const row of opportunities.rows) {
    assert.equal(row[status], 'New');
    assert.equal(row[draft], '');
    assert.equal(row[published], '');
    assert.equal(row[approval], '');
  }
  const windowStart = snapshots.headers.indexOf('Window Start');
  assert.ok(snapshots.rows.every((row) => row[windowStart] === windows.current.start));

  // A normal weekly rerun replaces the local files cleanly and preserves stable IDs.
  await processExports({
    currentPath: currentFixture,
    previousPath: previousFixture,
    outputDir,
    profile: 'new-site',
    source: 'Website',
    runDate: '2026-07-14',
    importedAt: '2026-07-14T12:00:00Z',
    windows,
  });
  const rerun = parseCsv(await readFile(result.opportunitiesPath, 'utf8'));
  const id = opportunities.headers.indexOf('Opportunity ID');
  assert.deepEqual(
    rerun.rows.map((row) => row[id]),
    opportunities.rows.map((row) => row[id]),
  );
});

test('initial-backfill option includes previous and current snapshot windows', async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), 'north-pine-gsc-backfill-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const result = await processExports({
    currentPath: currentFixture,
    previousPath: previousFixture,
    outputDir,
    profile: 'new-site',
    windows,
    includePreviousSnapshot: true,
    runDate: '2026-07-13',
    importedAt: '2026-07-13T12:00:00Z',
  });
  assert.equal(result.snapshotCount, 10);
});

test('CLI runs end to end with Node 22 and reports that it never approved or published', async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), 'north-pine-gsc-cli-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const script = join(root, 'gsc-processor.mjs');
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    script,
    currentFixture,
    previousFixture,
    '--current-end',
    '2026-07-12',
    '--run-date',
    '2026-07-13',
    '--output-dir',
    outputDir,
  ]);
  assert.equal(stderr, '');
  assert.match(stdout, /Computed 5 current-vs-previous metric deltas/);
  assert.match(stdout, /No content was approved, drafted, or published/);
  assert.ok((await readFile(join(outputDir, 'search-opportunities.csv'), 'utf8')).length > 0);
  assert.ok((await readFile(join(outputDir, 'performance-snapshots.csv'), 'utf8')).length > 0);
});

test('missing query/page dimensions fail with a useful message', () => {
  assert.throws(
    () => aggregateGscCsv('Query,Clicks,Impressions,Position\nfoo,1,10,8\n', 'bad.csv'),
    /missing required GSC column\(s\): page/,
  );
});
