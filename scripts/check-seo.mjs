#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const findings = [];

function relativeFile(file) {
  return path.relative(siteRoot, file).split(path.sep).join("/") || ".";
}

function lineAt(source, index) {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

function addFinding(rule, file, message, source = "", index = 0, severity = "error") {
  findings.push({
    rule,
    file: relativeFile(file),
    line: source ? lineAt(source, index) : 1,
    message,
    severity,
  });
}

function readRequired(relativePath) {
  const file = path.join(siteRoot, relativePath);
  try {
    return { file, source: fs.readFileSync(file, "utf8") };
  } catch (error) {
    addFinding("required-file", file, `Required file is missing or unreadable: ${error.message}`);
    return { file, source: "" };
  }
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === "#") {
      const radix = code[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? code.slice(2) : code.slice(1);
      const point = Number.parseInt(digits, radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function normalizeText(value) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function parseAttributes(rawTag) {
  const attributes = new Map();
  const body = rawTag.replace(/^<\/?[\w:-]+\s*/i, "").replace(/\/?\s*>$/, "");
  const attributePattern = /([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of body.matchAll(attributePattern)) {
    attributes.set(match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attributes;
}

function tags(source, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return [...source.matchAll(pattern)].map((match) => ({
    attributes: parseAttributes(match[0]),
    index: match.index,
    raw: match[0],
  }));
}

function pairedTags(source, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "gi");
  return [...source.matchAll(pattern)].map((match) => ({
    index: match.index,
    text: normalizeText(match[1].replace(/<[^>]*>/g, " ")),
  }));
}

function findHtmlFiles(directory) {
  const ignoredDirectories = new Set([".git", ".github", "node_modules", "scripts"]);
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findHtmlFiles(absolute));
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(absolute);
  }
  return files;
}

function safeDecodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function fileCandidatesForPathname(pathname) {
  const decoded = safeDecodePathname(pathname);
  if (decoded === null || decoded.includes("\\")) return [];

  const webPath = path.posix.normalize(`/${decoded}`);
  const relative = webPath.replace(/^\/+/, "");
  const candidateNames = [];

  if (webPath === "/" || webPath.endsWith("/")) {
    candidateNames.push(path.posix.join(relative, "index.html"));
  } else {
    candidateNames.push(relative);
    if (!path.posix.extname(relative)) {
      candidateNames.push(`${relative}.html`, path.posix.join(relative, "index.html"));
    }
  }

  return [...new Set(candidateNames)].map((candidate) => path.resolve(siteRoot, ...candidate.split("/")));
}

function existingFileForPathname(pathname) {
  return fileCandidatesForPathname(pathname).find((candidate) => {
    const relative = path.relative(siteRoot, candidate);
    return !relative.startsWith("..") && !path.isAbsolute(relative) && fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  });
}

function noindexMeta(source) {
  return tags(source, "meta").find(({ attributes }) => {
    const name = (attributes.get("name") ?? "").toLowerCase();
    const directives = (attributes.get("content") ?? "").toLowerCase().split(/[\s,]+/);
    return ["robots", "googlebot"].includes(name) && directives.includes("noindex");
  });
}

function idsIn(source) {
  const ids = new Set();
  for (const match of source.matchAll(/<[\w:-]+\b[^>]*>/g)) {
    const attributes = parseAttributes(match[0]);
    if (attributes.has("id")) ids.add(attributes.get("id"));
    if (attributes.has("name")) ids.add(attributes.get("name"));
  }
  return ids;
}

function visibleText(source) {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  let result = (body?.[1] ?? source)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return normalizeText(result.replace(/<\/(?:article|aside|div|figcaption|footer|h[1-6]|header|li|main|p|section)>/gi, ". ").replace(/<[^>]*>/g, " "));
}

function maskHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\r\n]/g, " "));
}

function maskPreservingLines(value) {
  return value.replace(/[^\r\n]/g, " ");
}

function searchableBodySource(source) {
  const bodyOpen = /<body\b[^>]*>/i.exec(source);
  if (!bodyOpen) return maskPreservingLines(source);

  const bodyStart = bodyOpen.index + bodyOpen[0].length;
  const bodyClose = /<\/body\s*>/i.exec(source.slice(bodyStart));
  const bodyEnd = bodyClose ? bodyStart + bodyClose.index : source.length;
  let result = `${maskPreservingLines(source.slice(0, bodyStart))}${source.slice(bodyStart, bodyEnd)}${maskPreservingLines(source.slice(bodyEnd))}`;

  for (const pattern of [
    /<!--[\s\S]*?-->/gi,
    /<script\b[\s\S]*?<\/script\s*>/gi,
    /<style\b[\s\S]*?<\/style\s*>/gi,
    /<svg\b[\s\S]*?<\/svg\s*>/gi,
  ]) {
    result = result.replace(pattern, maskPreservingLines);
  }
  return result;
}

function jsonLdBlocks(source) {
  const blocks = [];
  const pattern = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of source.matchAll(pattern)) {
    const openingEnd = match[0].indexOf(">");
    const openingTag = match[0].slice(0, openingEnd + 1);
    const attributes = parseAttributes(openingTag);
    if ((attributes.get("type") ?? "").trim().toLowerCase() !== "application/ld+json") continue;
    blocks.push({
      content: match[1],
      contentIndex: match.index + openingEnd + 1,
      index: match.index,
    });
  }
  return blocks;
}

function coordinateNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function structuredCapacity(value) {
  const candidates = value && typeof value === "object"
    ? [value.maxValue, value.value, value.maxGuests]
    : [value];
  return candidates
    .map(coordinateNumber)
    .find((candidate) => candidate !== null && Number.isInteger(candidate) && candidate > 0 && candidate <= 99) ?? null;
}

function collectJsonFacts(value, facts, trail = "$") {
  if (typeof value === "string") {
    facts.strings.push({ text: value, trail });
    return;
  }
  if (!value || typeof value !== "object") return;

  if (!Array.isArray(value)) {
    const latitude = coordinateNumber(value.latitude);
    const longitude = coordinateNumber(value.longitude);
    if (latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      facts.coordinates.push({ latitude, longitude, trail });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    const childTrail = Array.isArray(value) ? `${trail}[${key}]` : `${trail}.${key}`;
    if (/^(?:guestCapacity|max(?:imum)?Occupancy|occupancy)$/i.test(key)) {
      const capacity = structuredCapacity(child);
      if (capacity !== null) facts.occupancies.push({ capacity, trail: childTrail });
    }
    collectJsonFacts(child, facts, childTrail);
  }
}

function annotationEscape(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

const cname = readRequired("CNAME");
const expectedDomain = cname.source
  .split(/\r?\n/)
  .map((line) => line.trim().toLowerCase())
  .find((line) => line && !line.startsWith("#"));

if (!expectedDomain || expectedDomain.includes(":") || expectedDomain.includes("/")) {
  addFinding("domain", cname.file, "CNAME must contain one bare domain name, without a scheme or path.", cname.source);
}

const sitemap = readRequired("sitemap.xml");
const locMatches = [...sitemap.source.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)];
const openLocCount = (sitemap.source.match(/<loc\b/gi) ?? []).length;
if (locMatches.length === 0) addFinding("sitemap", sitemap.file, "Sitemap must contain at least one <loc> URL.", sitemap.source);
if (locMatches.length !== openLocCount) addFinding("sitemap", sitemap.file, "One or more <loc> elements are not closed correctly.", sitemap.source);

const sitemapPages = [];
const sitemapUrls = new Map();
const sitemapFiles = new Set();

for (const match of locMatches) {
  const rawValue = normalizeText(match[1]);
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    addFinding("sitemap", sitemap.file, `Invalid sitemap URL: ${rawValue || "(empty)"}`, sitemap.source, match.index);
    continue;
  }

  if (sitemapUrls.has(url.href)) {
    addFinding("sitemap", sitemap.file, `Duplicate sitemap URL: ${url.href}`, sitemap.source, match.index);
    continue;
  }
  sitemapUrls.set(url.href, match.index);

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== expectedDomain || url.port || url.username || url.password) {
    addFinding("domain", sitemap.file, `Sitemap URL must use https://${expectedDomain}: ${url.href}`, sitemap.source, match.index);
  }
  if (url.search || url.hash) {
    addFinding("sitemap", sitemap.file, `Sitemap URL must not contain a query string or fragment: ${url.href}`, sitemap.source, match.index);
  }

  const file = existingFileForPathname(url.pathname);
  if (!file) {
    addFinding("sitemap-file", sitemap.file, `No local file maps to sitemap URL ${url.href}`, sitemap.source, match.index);
    continue;
  }
  sitemapFiles.add(path.resolve(file).toLowerCase());

  if (!file.toLowerCase().endsWith(".html")) {
    addFinding("sitemap-file", sitemap.file, `Sitemap URL does not map to an HTML page: ${url.href}`, sitemap.source, match.index);
    continue;
  }

  const source = fs.readFileSync(file, "utf8");
  sitemapPages.push({ file, source, url });
}

const titles = new Map();
const descriptions = new Map();

for (const page of sitemapPages) {
  const pageTitles = pairedTags(page.source, "title");
  if (pageTitles.length !== 1 || !pageTitles[0]?.text) {
    addFinding("title", page.file, `Expected exactly one non-empty <title>; found ${pageTitles.length}.`, page.source, pageTitles[0]?.index ?? 0);
  } else {
    const key = pageTitles[0].text.toLocaleLowerCase("en-US");
    const prior = titles.get(key);
    if (prior) {
      addFinding("unique-title", page.file, `Title duplicates ${relativeFile(prior.file)}: “${pageTitles[0].text}”`, page.source, pageTitles[0].index);
    } else {
      titles.set(key, page);
    }
  }

  const descriptionTags = tags(page.source, "meta").filter(({ attributes }) => (attributes.get("name") ?? "").toLowerCase() === "description");
  const description = normalizeText(descriptionTags[0]?.attributes.get("content") ?? "");
  if (descriptionTags.length !== 1 || !description) {
    addFinding("meta-description", page.file, `Expected exactly one non-empty meta description; found ${descriptionTags.length}.`, page.source, descriptionTags[0]?.index ?? 0);
  } else {
    const key = description.toLocaleLowerCase("en-US");
    const prior = descriptions.get(key);
    if (prior) {
      addFinding("unique-description", page.file, `Meta description duplicates ${relativeFile(prior.file)}: “${description}”`, page.source, descriptionTags[0].index);
    } else {
      descriptions.set(key, page);
    }
  }

  const canonicalTags = tags(page.source, "link").filter(({ attributes }) =>
    (attributes.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"),
  );
  if (canonicalTags.length !== 1) {
    addFinding("canonical", page.file, `Expected exactly one canonical link; found ${canonicalTags.length}.`, page.source, canonicalTags[0]?.index ?? 0);
  } else {
    const href = canonicalTags[0].attributes.get("href") ?? "";
    let canonical;
    try {
      canonical = new URL(href);
    } catch {
      addFinding("canonical", page.file, `Canonical must be an absolute URL: ${href || "(empty)"}`, page.source, canonicalTags[0].index);
    }
    if (canonical) {
      if (canonical.protocol !== "https:" || canonical.hostname.toLowerCase() !== expectedDomain || canonical.port || canonical.username || canonical.password) {
        addFinding("domain", page.file, `Canonical must use https://${expectedDomain}: ${canonical.href}`, page.source, canonicalTags[0].index);
      }
      if (canonical.search || canonical.hash) {
        addFinding("canonical", page.file, `Canonical must not contain a query string or fragment: ${canonical.href}`, page.source, canonicalTags[0].index);
      }
      if (canonical.href !== page.url.href) {
        addFinding("canonical", page.file, `Canonical ${canonical.href} does not match sitemap URL ${page.url.href}`, page.source, canonicalTags[0].index);
      }
    }
  }

  const headings = pairedTags(page.source, "h1");
  if (headings.length !== 1 || !headings[0]?.text) {
    addFinding("h1", page.file, `Expected exactly one non-empty <h1>; found ${headings.length}.`, page.source, headings[0]?.index ?? 0);
  }

}

for (const file of findHtmlFiles(siteRoot)) {
  const source = fs.readFileSync(file, "utf8");
  const noindex = noindexMeta(source);
  if (noindex && sitemapFiles.has(path.resolve(file).toLowerCase())) {
    addFinding("noindex-sitemap", file, "A noindex page must not appear in sitemap.xml.", source, noindex.index);
  }
}

const targetCache = new Map();
const localReferences = [
  ["a", "href"],
  ["iframe", "src"],
  ["img", "src"],
  ["link", "href"],
  ["script", "src"],
  ["source", "src"],
  ["video", "poster"],
];

for (const page of sitemapPages) {
  const sourceWithoutComments = maskHtmlComments(page.source);
  for (const [tagName, attribute] of localReferences) {
    for (const tag of tags(sourceWithoutComments, tagName)) {
      const rawTarget = (tag.attributes.get(attribute) ?? "").trim();
      if (!rawTarget || rawTarget.startsWith("#") && rawTarget.length === 1) continue;

      let targetUrl;
      try {
        targetUrl = new URL(rawTarget, page.url);
      } catch {
        addFinding("local-link", page.file, `Invalid ${tagName} ${attribute}: ${rawTarget}`, page.source, tag.index);
        continue;
      }

      if (!["http:", "https:"].includes(targetUrl.protocol)) continue;
      if (targetUrl.hostname.toLowerCase() !== expectedDomain) continue;

      const targetFile = existingFileForPathname(targetUrl.pathname);
      if (!targetFile) {
        addFinding("local-link", page.file, `Local target does not exist: ${rawTarget}`, page.source, tag.index);
        continue;
      }

      if (targetUrl.hash && targetFile.toLowerCase().endsWith(".html")) {
        let fragment;
        try {
          fragment = decodeURIComponent(targetUrl.hash.slice(1));
        } catch {
          addFinding("local-link", page.file, `Fragment is not valid URL encoding: ${rawTarget}`, page.source, tag.index);
          continue;
        }

        const cacheKey = path.resolve(targetFile).toLowerCase();
        if (!targetCache.has(cacheKey)) {
          const targetSource = fs.readFileSync(targetFile, "utf8");
          targetCache.set(cacheKey, idsIn(targetSource));
        }
        if (fragment && !targetCache.get(cacheKey).has(fragment)) {
          addFinding("local-link", page.file, `Fragment target #${fragment} does not exist in ${relativeFile(targetFile)}.`, page.source, tag.index);
        }
      }
    }
  }
}

const robots = readRequired("robots.txt");
const robotGroups = [];
let currentGroup = null;

function finishRobotGroup() {
  if (currentGroup?.agents.length) robotGroups.push(currentGroup);
  currentGroup = null;
}

for (const [lineNumber, originalLine] of robots.source.split(/\r?\n/).entries()) {
  const line = originalLine.replace(/\s+#.*$/, "").trim();
  if (!line) {
    if (currentGroup?.directives.length) finishRobotGroup();
    continue;
  }

  const separator = line.indexOf(":");
  if (separator < 0) continue;
  const key = line.slice(0, separator).trim().toLowerCase();
  const value = line.slice(separator + 1).trim();

  if (key === "user-agent") {
    if (currentGroup?.directives.length) finishRobotGroup();
    currentGroup ??= { agents: [], directives: [], line: lineNumber + 1 };
    currentGroup.agents.push(value.toLowerCase());
  } else if (currentGroup) {
    currentGroup.directives.push({ key, value, line: lineNumber + 1 });
  }
}
finishRobotGroup();

const oaiGroup = robotGroups.find((group) => group.agents.includes("oai-searchbot"));
if (!oaiGroup) {
  addFinding("oai-searchbot", robots.file, "robots.txt must contain an explicit User-agent: OAI-SearchBot group with Allow: /.", robots.source);
} else {
  const allowsRoot = oaiGroup.directives.some(({ key, value }) => key === "allow" && value === "/");
  const blocksRoot = oaiGroup.directives.some(({ key, value }) => key === "disallow" && ["/", "/*"].includes(value));
  if (!allowsRoot || blocksRoot) {
    addFinding("oai-searchbot", robots.file, "OAI-SearchBot must be explicitly allowed at / and must not be blocked at the root.", robots.source, robots.source.split(/\r?\n/).slice(0, oaiGroup.line - 1).join("\n").length);
  }
}

const unresolvedPatterns = [
  { label: "editor note", pattern: /<!--(?:(?!-->)[\s\S])*?\bEDIT\s*:(?:(?!-->)[\s\S])*?-->/gi, severity: "warning" },
  { label: "verification marker", pattern: /\[VERIFY(?::[^\]]*)?\]/gi, severity: "error" },
  { label: "task marker", pattern: /\b(?:FIXME|REPLACE[_ -]?ME|TBD|TODO)\b/gi, severity: "warning" },
  { label: "template token", pattern: /\{\{[^{}\r\n]+\}\}/g, severity: "warning" },
  { label: "placeholder copy", pattern: /\b(?:add your (?:copy|image|link|photo|text)|insert (?:copy|image|link|photo|text) here|lorem ipsum)\b/gi, severity: "warning" },
];

for (const page of sitemapPages) {
  for (const { label, pattern, severity } of unresolvedPatterns) {
    pattern.lastIndex = 0;
    for (const match of page.source.matchAll(pattern)) {
      const excerpt = normalizeText(match[0].replace(/<!--|-->/g, " ")).slice(0, 110);
      addFinding("unresolved-marker", page.file, `Unresolved ${label}: “${excerpt}${excerpt.length === 110 ? "…" : ""}”`, page.source, match.index, severity);
    }
  }
}

// Keep this list aligned with owner-verified property facts. Remove an item only
// after it is installed, inspected, and genuinely available to book.
const plannedAmenities = [
  { label: "hot tub", pattern: /\bhot tub\b/i },
  { label: "sauna", pattern: /\bsauna\b/i },
  { label: "stargazing nets", pattern: /\bstargazing nets?\b/i },
  { label: "theater", pattern: /\btheater\b/i },
  { label: "firepit", pattern: /\bfire\s?pit\b/i },
  { label: "exterior lighting", pattern: /\bexterior lighting\b/i },
];
const truthfulQualifier = /\b(?:after installation|ahead of opening|before (?:booking|dates|opening|reservations)|coming soon|future|in progress|not (?:a promise|available|bookable|open|yet)|opening list|plan(?:ned)?|renovation|still being (?:prepared|renovated)|underway|when (?:completed|confirmed|finished)|will (?:be|feature|have|include|offer))\b/i;
const currentClaimCue = /\b(?:access|all to yourselves|all yours|available|back in|book|enjoy|features?|has|includes?|installed|offers?|open|provides?|ready|relax|return to|soak|swimsuit for|use of|waiting|with)\b/i;

// The owner has confirmed a current maximum of eight, but public occupancy
// claims remain locked until the applicable county/permit limit is revalidated.
// Precise location details also remain locked.
const launchFacts = Object.freeze({
  approvedOccupancyVerified: false,
  preciseCoordinatesVerified: false,
});
const capacityNumber = String.raw`(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)`;
const occupancyClaimSource = String.raw`\b(?:(?:sleeps?|accommodates?|hosts?)\s+(?:up to\s+)?${capacityNumber}(?:\s+(?:guests?|people|persons?))?|room\s+for\s+(?:up to\s+)?${capacityNumber}(?:\s+(?:guests?|people|persons?))?|(?:guest|sleeping)\s+capacity\s*(?:(?:is|of)\s+|[:=-]\s*)?${capacityNumber}|(?:maximum|max|approved)\s+(?:guest\s+)?occupancy\s*(?:(?:is|of)\s+|[:=-]\s*)?${capacityNumber}|occupancy\s*(?:(?:is|of)\s+|[:=-]\s*)${capacityNumber}|(?:up to|maximum of)\s+${capacityNumber}\s+(?:guests?|people|persons?)|${capacityNumber}[- ](?:guest|person))\b`;
const ownerFactQualifier = /\b(?:awaiting\s+(?:approval|confirmation|verification)|(?:could|may)\s+(?:accommodate|host|sleep)|expected\s+to|not\s+(?:yet\s+)?(?:confirmed|final|finalized|verified)|pending\s+(?:approval|confirmation|inspection|verification)|plan\s+is\s+to|planned|planning\s+to|proposed|target(?:ed)?|tentative|to\s+be\s+(?:confirmed|finalized|verified)|unconfirmed|unverified|will\s+be\s+(?:confirmed|finalized|verified))\b|\b(?:needs?|requires?)\s+(?:confirmation|verification)\b/i;

function occupancyMatches(value) {
  return [...value.matchAll(new RegExp(occupancyClaimSource, "gi"))];
}

for (const page of sitemapPages) {
  const fields = [
    ...pairedTags(page.source, "title").map((field) => ({ ...field, kind: "title" })),
    ...tags(page.source, "meta")
      .filter(({ attributes }) => ["description", "og:description", "og:title"].includes((attributes.get("name") ?? attributes.get("property") ?? "").toLowerCase()))
      .map((field) => ({ index: field.index, kind: "metadata", text: normalizeText(field.attributes.get("content") ?? "") })),
  ];

  const text = visibleText(page.source);
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const amenity of plannedAmenities) {
    const riskyFields = fields.filter((field) => amenity.pattern.test(field.text) && !truthfulQualifier.test(field.text));
    if (riskyFields.length) {
      const field = riskyFields[0];
      const fieldCount = riskyFields.length > 1 ? ` (${riskyFields.length} title/metadata fields)` : "";
      addFinding("planned-amenity", page.file, `${field.kind} presents the planned ${amenity.label} as currently available${fieldCount}: “${field.text}”`, page.source, field.index);
    }

    const riskySentence = sentences.find((sentence) => amenity.pattern.test(sentence) && currentClaimCue.test(sentence) && !truthfulQualifier.test(sentence));
    if (riskySentence) {
      const excerpt = riskySentence.slice(0, 180);
      const occurrences = [...page.source.matchAll(new RegExp(amenity.pattern.source, "gi"))];
      const rawIndex = occurrences.find((match) => {
        const start = Math.max(0, match.index - 240);
        const end = Math.min(page.source.length, match.index + match[0].length + 240);
        const context = visibleText(page.source.slice(start, end));
        return currentClaimCue.test(context) && !truthfulQualifier.test(context);
      })?.index ?? occurrences[0]?.index ?? 0;
      addFinding("planned-amenity", page.file, `Copy may present the planned ${amenity.label} as currently available: “${excerpt}${riskySentence.length > 180 ? "…" : ""}”`, page.source, Math.max(0, rawIndex));
    }
  }
}

for (const page of sitemapPages) {
  const fields = [
    ...pairedTags(page.source, "title").map((field) => ({ ...field, kind: "title" })),
    ...tags(page.source, "meta")
      .filter(({ attributes }) => ["description", "og:description", "og:title"].includes((attributes.get("name") ?? attributes.get("property") ?? "").toLowerCase()))
      .map((field) => ({ index: field.index, kind: "metadata", text: normalizeText(field.attributes.get("content") ?? "") })),
  ];

  if (!launchFacts.approvedOccupancyVerified) {
    const reportedClaims = new Set();
    const reportClaims = (value, sourceIndex, kind) => {
      for (const match of occupancyMatches(value)) {
        const context = normalizeText(value.slice(Math.max(0, match.index - 180), match.index + match[0].length + 180));
        if (ownerFactQualifier.test(context)) continue;
        const findingIndex = Math.max(0, sourceIndex + match.index);
        const key = `${findingIndex}:${match[0].toLowerCase()}`;
        if (reportedClaims.has(key)) continue;
        reportedClaims.add(key);
        addFinding(
          "unverified-occupancy",
          page.file,
          `${kind} makes a live occupancy claim before approved maximum occupancy is verified: "${match[0]}"`,
          page.source,
          findingIndex,
        );
      }
    };

    for (const field of fields) reportClaims(field.text, field.index, field.kind);

    const searchableBody = searchableBodySource(page.source);
    for (const match of occupancyMatches(searchableBody)) {
      const context = normalizeText(
        searchableBody
          .slice(Math.max(0, match.index - 180), match.index + match[0].length + 180)
          .replace(/<[^>]*>/g, " "),
      );
      if (ownerFactQualifier.test(context)) continue;
      const key = `${match.index}:${match[0].toLowerCase()}`;
      if (reportedClaims.has(key)) continue;
      reportedClaims.add(key);
      addFinding(
        "unverified-occupancy",
        page.file,
        `Page copy makes a live occupancy claim before approved maximum occupancy is verified: "${normalizeText(match[0])}"`,
        page.source,
        match.index,
      );
    }

    for (const input of tags(searchableBody, "input")) {
      const identity = ["id", "name", "aria-label", "placeholder"]
        .map((attribute) => input.attributes.get(attribute) ?? "")
        .join(" ");
      const maximum = input.attributes.get("max") ?? "";
      if (!/\b(?:guest|group|occupan|party)\w*\b/i.test(identity) || !/^\d{1,2}$/.test(maximum.trim())) continue;
      if (ownerFactQualifier.test(identity)) continue;
      addFinding(
        "unverified-occupancy",
        page.file,
        `Guest-count input enforces max="${maximum.trim()}" before approved maximum occupancy is verified.`,
        page.source,
        input.index,
      );
    }

    for (const block of jsonLdBlocks(page.source)) {
      let document;
      try {
        document = JSON.parse(block.content);
      } catch {
        continue;
      }
      const facts = { coordinates: [], occupancies: [], strings: [] };
      collectJsonFacts(document, facts);
      for (const fact of facts.strings) {
        const rawOffset = block.content.indexOf(fact.text);
        reportClaims(fact.text, block.contentIndex + Math.max(0, rawOffset), `JSON-LD string at ${fact.trail}`);
      }
      for (const occupancy of facts.occupancies) {
        const property = occupancy.trail.match(/\.([^.\[]+)$/)?.[1] ?? "occupancy";
        const rawOffset = block.content.toLowerCase().indexOf(`"${property.toLowerCase()}"`);
        addFinding(
          "unverified-occupancy",
          page.file,
          `JSON-LD publishes guest capacity ${occupancy.capacity} at ${occupancy.trail} before approved maximum occupancy is verified.`,
          page.source,
          block.contentIndex + Math.max(0, rawOffset),
        );
      }
    }
  }

  if (!launchFacts.preciseCoordinatesVerified) {
    for (const block of jsonLdBlocks(page.source)) {
      let document;
      try {
        document = JSON.parse(block.content);
      } catch {
        continue;
      }
      const facts = { coordinates: [], occupancies: [], strings: [] };
      collectJsonFacts(document, facts);
      for (const coordinates of facts.coordinates) {
        const latitudeOffset = block.content.search(/["']latitude["']\s*:/i);
        addFinding(
          "unverified-geo",
          page.file,
          `JSON-LD publishes property coordinates (${coordinates.latitude}, ${coordinates.longitude}) at ${coordinates.trail} before precise location is owner-verified.`,
          page.source,
          block.contentIndex + Math.max(0, latitudeOffset),
        );
      }
    }
  }
}

findings.sort((a, b) => a.severity.localeCompare(b.severity) || a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));

const errors = findings.filter(({ severity }) => severity === "error");
const warnings = findings.filter(({ severity }) => severity === "warning");

function printFindings(items) {
  for (const finding of items) {
    const output = finding.severity === "error" ? console.error : console.warn;
    output(`- [${finding.rule}] ${finding.file}:${finding.line} ${finding.message}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      output(`::${finding.severity} file=${annotationEscape(finding.file)},line=${finding.line},title=${annotationEscape(`SEO: ${finding.rule}`)}::${annotationEscape(finding.message)}`);
    }
  }
}

if (errors.length) {
  console.error(`SEO quality check failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  printFindings(errors);
  if (warnings.length) {
    console.warn(`SEO quality check also found ${warnings.length} warning${warnings.length === 1 ? "" : "s"}:`);
    printFindings(warnings);
  }
  process.exitCode = 1;
} else {
  console.log(`SEO quality check passed for ${sitemapPages.length} sitemap HTML page${sitemapPages.length === 1 ? "" : "s"}.`);
  console.log(`Domain: https://${expectedDomain}`);
  console.log("Checked sitemap mapping, canonicals, metadata uniqueness, H1s, local targets, noindex exclusions, robots permission, publishing-risk copy, and unverified launch facts.");
  if (warnings.length) {
    console.warn(`Found ${warnings.length} non-blocking warning${warnings.length === 1 ? "" : "s"}:`);
    printFindings(warnings);
  }
}
