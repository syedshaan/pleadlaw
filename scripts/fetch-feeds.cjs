// scripts/fetch-feeds.cjs
//
// Runs every 6 hours via GitHub Actions.
// Fetches configured RSS feeds and writes candidate items into
// news-pending.json and jobs-pending.json for manual review.
//
// NEWS: after being added to news-pending.json, items are also
// auto-published directly into news.json (direct auto-publish mode),
// skipping anything already published and anything that still has
// leftover HTML entities or missing title/link (safety filter).
// New items are capped per source per run to keep sources balanced.
//
// JOBS: matched listings are retained as leads and auto-published with their
// source link. Auto-publication does not mean a vacancy has been verified.

const fs = require("fs");
const path = require("path");
const https = require("https");

const CONFIG_PATH = path.join(__dirname, "feeds.config.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const NEWS_PENDING_PATH = path.join(PUBLIC_DIR, "news-pending.json");
const JOBS_PENDING_PATH = path.join(PUBLIC_DIR, "jobs-pending.json");
const NEWS_PATH = path.join(PUBLIC_DIR, "news.json");
const JOBS_PATH = path.join(PUBLIC_DIR, "jobs.json");

const JOB_MAX_AGE_DAYS = 20;
const JOB_VACANCY_REGEX =
  /\b(?:vacanc(?:y|ies)|hiring|job openings?|positions? available|applications? invited|invites? applications?|apply\s+(?:for|online|now|by|before|till|until)|recruitment notification|recruitment drive|recruitment for|recruit(?:s|ed|ing)?\s+(?:for|to)|to recruit|internships?|interns?(?:\s+(?:positions?|opportunities))?|\d+\s+(?:posts?|positions?|vacancies|openings))\b/i;
const LEGAL_ROLE_REGEX =
  /\b(?:law|legal|advocat(?:e|es)|lawyer|judiciar(?:y|ies)|judicial|court|paralegal|prosecutor)\b/i;
// Max new news items taken from each source per run (keeps sources balanced)
const MAX_NEWS_PER_SOURCE = 3;
const MAX_PUBLISHED_NEWS_PER_SOURCE = 5;

// ---------- helpers ----------

function stripHtml(html) {
  if (!html) return "";
  let decoded = html;
  for (let i = 0; i < 3; i++) {
    const next = decodeHtmlEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity) =>
      decodeHtmlEntities(entity)
    )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, value) => {
    if (value[0] !== "#") {
      return namedEntities[value.toLowerCase()] || entity;
    }

    const codePoint = value[1].toLowerCase() === "x"
      ? Number.parseInt(value.slice(2), 16)
      : Number.parseInt(value.slice(1), 10);
    if (
      !Number.isInteger(codePoint) ||
      codePoint < 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return entity;
    }
    return String.fromCodePoint(codePoint);
  });
}

function getJobSector(text) {
  if (/\b(?:legal\s+)?internships?\b|\binterns?\b/i.test(text)) {
    return "Legal internships";
  }
  if (
    /\b(?:supreme court|high court|district court|judicial service|judiciary|court assistant|court clerk|court\s+(?:of|recruitment|vacanc(?:y|ies)|invites?|seeks?))\b/i.test(
      text
    )
  ) {
    return "Courts & judiciary";
  }
  if (
    /\b(?:government|govt\.?|ministry|department|commission|authority|public sector|psu|state service|central service|legal services authority)\b/i.test(
      text
    )
  ) {
    return "Government & ministries";
  }
  if (
    /\b(?:law firm|legal firm|advocates? firm|private sector|private limited|corporate|company|firm|in-house|law office|llp|limited|ltd\.?)\b/i.test(
      text
    )
  ) {
    return "Law firms & private sector";
  }
  return "";
}

function getRecentJobDate(pubDate, now = Date.now()) {
  const timestamp = Date.parse(pubDate || "");
  if (Number.isNaN(timestamp) || timestamp > now) return null;
  const age = now - timestamp;
  return age <= JOB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    ? new Date(timestamp)
    : null;
}

function isEligibleJobAnnouncement(item, now = Date.now()) {
  const text = getJobText(item);
  return (
    item.country === "India" &&
    Boolean(item.title) &&
    isHttpsUrl(item.link) &&
    Boolean(getRecentJobDate(item.pubDate, now)) &&
    LEGAL_ROLE_REGEX.test(text) &&
    JOB_VACANCY_REGEX.test(text) &&
    Boolean(item.sector || getJobSector(text))
  );
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PleadlawFeedBot/1.0; +https://pleadlaw.vercel.app)",
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      )
      .on("error", (err) => reject(err));
  });
}

// Minimal, dependency-free <item> extractor for RSS 2.0 feeds.
// Avoids adding an XML parser package since this is a lightweight script.
function extractItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];

  for (const block of itemBlocks) {
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      description: extractTag(block, "description"),
      contentEncoded: extractTag(block, "content:encoded"),
      image: extractImageUrl(block),
      guid: extractTag(block, "guid"),
      sourceUrl: extractAttr(block, "source", "url"),
      sourceName: extractTag(block, "source"),
    });
  }

  return items;
}

function extractImageUrl(block) {
  const candidates = [
    block.match(/<(?:media:content|media:thumbnail)\b[^>]*\burl=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<enclosure\b(?=[^>]*\btype=["']image\/)[^>]*\burl=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)?.[1],
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const decoded = decodeHtmlEntities(candidate.trim());
    const normalized = decoded.startsWith("//") ? `https:${decoded}` : decoded;
    try {
      const url = new URL(normalized);
      if (url.protocol === "https:") return url.href;
    } catch {
      continue;
    }
  }
  return "";
}

function extractTag(block, tagName) {
  const escaped = tagName.replace(":", "\\:");
  const regex = new RegExp(
    `<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`,
    "i"
  );
  const match = block.match(regex);
  if (!match) return "";
  return match[1]
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function extractAttr(block, tagName, attrName) {
  const regex = new RegExp(
    `<${tagName}[^>]*${attrName}="([^"]*)"[^>]*>`,
    "i"
  );
  const match = block.match(regex);
  return match ? match[1] : "";
}

function makeId(sourceName, link, pubDate) {
  const raw = `${sourceName}|${link}|${pubDate}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `item-${Math.abs(hash)}`;
}

function loadJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// Appends new items to an existing pending file, skipping duplicates by id.
function appendToPending(filePath, newItems) {
  const existing = loadJsonSafe(filePath, []);
  const existingIds = new Set(existing.map((it) => it.id));

  const toAdd = newItems.filter((it) => !existingIds.has(it.id));

  const combined = [...existing, ...toAdd];
  saveJson(filePath, combined);

  return { added: toAdd.length, skipped: newItems.length - toAdd.length };
}

function loadPublishedJobs() {
  const parsed = JSON.parse(fs.readFileSync(JOBS_PATH, "utf8"));
  const jobs = Array.isArray(parsed) ? parsed : parsed?.jobs;
  if (!Array.isArray(jobs)) {
    throw new Error(`${JOBS_PATH} must contain an array or an object with a jobs array`);
  }
  return jobs;
}

// ---------- auto-publish logic ----------

// Summaries are plain text by the time they reach this check.
function isSafeToAutoPublish(item) {
  return Boolean(item.title && isHttpsUrl(item.link));
}

// Converts a pending-style news item into the shape used in news.json.
// news.json uses: id, title, summary, source, url, date, category.
function toPublishedNewsItem(item) {
  const summary = item.summary || "";
  const publishedAt = new Date(item.pubDate);
  const published = {
    id: item.id,
    title: item.title,
    summary:
      summary.length > 220 ? summary.slice(0, 217).trimEnd() + "..." : summary,
    source: item.sourceName,
    url: item.link,
    date: Number.isNaN(publishedAt.getTime())
      ? ""
      : publishedAt.toISOString().slice(0, 10),
    category: item.category,
  };
  if (item.image) published.image = item.image;
  return published;
}

// Auto-publishes qualifying news items straight into news.json.
// Skips items already published (by id or by url) and items that fail
// the safety filter (missing fields or leftover HTML entities).
function autoPublishNews(newItems) {
  const existing = loadJsonSafe(NEWS_PATH, []);
  const existingIds = new Set(existing.map((it) => it.id));
  const existingUrls = new Set(existing.map((it) => it.url));

  let publishedCount = 0;
  let skippedDuplicate = 0;
  let skippedUnsafe = 0;
  let enrichedExisting = false;
  const existingByUrl = new Map(existing.map((item) => [item.url, item]));

  const toPublish = [];

  for (const item of newItems) {
    if (existingIds.has(item.id) || existingUrls.has(item.link)) {
      const existingItem = existingByUrl.get(item.link);
      if (existingItem && !existingItem.image && item.image) {
        existingItem.image = item.image;
        enrichedExisting = true;
      }
      skippedDuplicate++;
      continue;
    }
    if (!isSafeToAutoPublish(item)) {
      skippedUnsafe++;
      console.warn(
        `[fetch-feeds] Skipped auto-publish (unsafe/incomplete): "${item.title || "(no title)"}" from ${item.sourceName}`
      );
      continue;
    }
    toPublish.push(toPublishedNewsItem(item));
    existingIds.add(item.id);
    existingUrls.add(item.link);
    publishedCount++;
  }

  const seenIds = new Set();
  const seenUrls = new Set();
  const uniqueItems = [...existing, ...toPublish].filter((item) => {
    if (
      (item.id && seenIds.has(item.id)) ||
      (item.url && seenUrls.has(item.url))
    ) {
      return false;
    }
    if (item.id) seenIds.add(item.id);
    if (item.url) seenUrls.add(item.url);
    return true;
  });
  uniqueItems.sort((a, b) => {
    const dateA = Date.parse(a.date || "");
    const dateB = Date.parse(b.date || "");
    return (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA);
  });

  const sourceCounts = new Map();
  const balancedItems = uniqueItems.filter((item) => {
    const source = item.source || "Unknown";
    const count = sourceCounts.get(source) || 0;
    if (count >= MAX_PUBLISHED_NEWS_PER_SOURCE) return false;
    sourceCounts.set(source, count + 1);
    return true;
  });

  if (balancedItems.length !== existing.length || toPublish.length > 0 || enrichedExisting) {
    saveJson(NEWS_PATH, balancedItems);
  }

  console.log(
    `[fetch-feeds] news.json auto-publish: +${publishedCount} published, ${skippedDuplicate} duplicate(s) skipped, ${skippedUnsafe} unsafe/incomplete skipped, capped at ${MAX_PUBLISHED_NEWS_PER_SOURCE} per source`
  );
}

function toPublishedJob(item) {
  const posted = new Date(item.pubDate);
  const description = getJobDescription(item);
  const details = `${item.title} ${item.summary}`;
  return {
    id: item.id,
    title: item.title,
    organisation: item.organisation || "",
    type: item.jobType || item.sector,
    sector: item.sector,
    vacancyCount: extractVacancyCount(details),
    location: item.location || "",
    description,
    posted: Number.isNaN(posted.getTime()) ? "" : posted.toISOString(),
    lastDate: extractApplicationDeadline(details, item.pubDate),
    url: item.link,
    verified: false,
    autoCollected: true,
    source: item.sourceName,
    sourceUrl: item.sourceUrl || "",
  };
}

function getJobDescription(item) {
  let description = (item.summary || "").trim();
  for (const boilerplate of [item.title, item.sourceName]) {
    if (boilerplate) {
      description = description
        .replace(new RegExp(escapeRegExp(boilerplate), "ig"), " ")
        .trim();
    }
  }
  description = description.replace(/^[\s:—|·-]+|[\s:—|·-]+$/g, "").trim();
  return description.length > 450
    ? `${description.slice(0, 447).trimEnd()}...`
    : description;
}

function getJobText(item) {
  return `${item.title} ${getJobDescription(item)} ${
    item.organisation || ""
  } ${item.jobType || ""}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVacancyCount(text) {
  const match = text.match(
    /\b(\d{1,4})\s+(?:vacanc(?:y|ies)|posts?|positions?|openings?|seats?)\b|\b(?:vacanc(?:y|ies)|posts?|positions?|openings?|seats?)\s*[:=-]\s*(\d{1,4})\b/i
  );
  const count = match ? Number(match[1] || match[2]) : 0;
  return count > 0 ? count : null;
}

function extractApplicationDeadline(text, pubDate) {
  const datePattern =
    "(?:\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\.?[,]?(?:\\s+\\d{4})?|[A-Za-z]{3,9}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?(?:\\s+\\d{4})?|\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{4}-\\d{2}-\\d{2})";
  const match = text.match(
    new RegExp(
      `\\b(?:last date(?: to apply| for (?:submission|application))?|application deadline|deadline|closing date|apply\\s+(?:by|before|till|until))\\s*(?:is|:|-)?\\s*(${datePattern})`,
      "i"
    )
  );
  if (!match) return "";

  let dateText = match[1].replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  const numericDate = dateText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  let date;
  if (numericDate) {
    const [, day, month, year] = numericDate;
    date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)
    ) {
      return "";
    }
  } else {
    const isoDate = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      const [, year, month, day] = isoDate;
      date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (
        date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() !== Number(month) - 1 ||
        date.getUTCDate() !== Number(day)
      ) {
        return "";
      }
      return date.toISOString().slice(0, 10);
    }
    if (!/\b\d{4}\b/.test(dateText)) {
      const referenceDate = new Date(pubDate);
      if (Number.isNaN(referenceDate.getTime())) return "";
      dateText = `${dateText} ${referenceDate.getUTCFullYear()}`;
    }
    date = new Date(dateText);
  }

  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function autoPublishJobListings(items) {
  const existing = loadPublishedJobs();
  const now = Date.now();
  const currentJobs = existing.filter(
    (job) =>
      !job.autoCollected ||
      Boolean(getRecentJobDate(job.posted, now))
  );
  const existingIds = new Set(currentJobs.map((job) => job.id));
  const existingUrls = new Set(
    currentJobs.map((job) => job.url).filter(Boolean)
  );
  const toPublish = [];
  let skippedDuplicate = 0;
  let skippedUnsafe = 0;

  for (const item of items) {
    if (existingIds.has(item.id) || existingUrls.has(item.link)) {
      skippedDuplicate++;
      continue;
    }
    if (!isSafeToAutoPublish(item) || !isEligibleJobAnnouncement(item, now)) {
      skippedUnsafe++;
      console.warn(
        `[fetch-feeds] Skipped job (unsafe/ineligible): "${item.title || "(no title)"}" from ${item.sourceName}`
      );
      continue;
    }
    toPublish.push(toPublishedJob(item));
    existingIds.add(item.id);
    existingUrls.add(item.link);
  }

  if (toPublish.length > 0 || currentJobs.length !== existing.length) {
    saveJson(JOBS_PATH, { jobs: [...currentJobs, ...toPublish] });
  }

  console.log(
    `[fetch-feeds] jobs.json auto-publish: +${toPublish.length} auto-collected, ${skippedDuplicate} duplicate(s) skipped, ${skippedUnsafe} unsafe/ineligible skipped, auto-collected listings limited to ${JOB_MAX_AGE_DAYS} days`
  );
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// ---------- core fetch logic ----------

async function fetchAndParse(source) {
  let xml;
  try {
    xml = await fetchUrl(source.url);
  } catch (err) {
    console.error(`[fetch-feeds] FAILED: ${source.name} (${source.url})`);
    console.error(`  Reason: ${err.message}`);
    return [];
  }

  const rawItems = extractItems(xml);

  const items = rawItems.map((raw) => {
    const summaryHtml = source.useContentEncoded
      ? raw.contentEncoded || raw.description
      : raw.description;

    const summary = stripHtml(summaryHtml);
    const item = {
      id: makeId(source.name, raw.link, raw.pubDate),
      title: stripHtml(raw.title),
      link: raw.link,
      pubDate: raw.pubDate,
      summary,
      image: raw.image,
      sourceName: stripHtml(raw.sourceName) || source.name,
      sourceUrl: raw.sourceUrl || source.url,
      category: source.category,
      isOfficialSource: source.official === true,
      organisation: source.organisation || "",
      jobType: source.jobType,
      location: source.location,
      country: source.country || "",
      fetchedAt: new Date().toISOString(),
    };
    item.sector = getJobSector(getJobText(item));
    return item;
  });

  return items;
}

function getJobRejectionReason(item, now = Date.now()) {
  if (item.country !== "India") return "outside-India-scope";
  if (!item.title) return "missing-title";
  if (!isHttpsUrl(item.link)) return "missing-or-invalid-link";
  const timestamp = Date.parse(item.pubDate || "");
  if (Number.isNaN(timestamp)) return "missing-or-invalid-date";
  if (timestamp > now) return "future-date";
  if (now - timestamp > JOB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
    return `older-than-${JOB_MAX_AGE_DAYS}-days`;
  }
  const text = getJobText(item);
  if (!LEGAL_ROLE_REGEX.test(text)) return "not-legal-sector";
  if (!JOB_VACANCY_REGEX.test(text)) return "not-a-vacancy-announcement";
  if (!item.sector) return "sector-not-identifiable";
  return "";
}

function saveRecentJobLeads(newItems) {
  const existing = loadJsonSafe(JOBS_PENDING_PATH, []);
  const now = Date.now();
  const unique = new Map();
  for (const item of [...existing, ...newItems]) {
    if (isEligibleJobAnnouncement(item, now)) {
      unique.set(item.link || item.id, item);
    }
  }
  const recent = [...unique.values()].sort(
    (a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate)
  );
  saveJson(JOBS_PENDING_PATH, recent);
  return { count: recent.length };
}

async function run() {
  const feedsConfig = loadJsonSafe(CONFIG_PATH, {
    news: [],
    jobLeads: [],
    jobsManualOnly: [],
  });

  const { news = [], jobLeads = [] } = feedsConfig;

  console.log(`[fetch-feeds] Starting run at ${new Date().toISOString()}`);
  console.log(`[fetch-feeds] News sources: ${news.length}`);
  console.log(`[fetch-feeds] Job lead sources: ${jobLeads.length}`);

  // --- News sources ---
  let allNewsItems = [];
  for (const source of news) {
    console.log(`[fetch-feeds] Fetching news: ${source.name}`);
    const items = await fetchAndParse(source);
    console.log(`  -> ${items.length} item(s) found`);

    // Newest first, then keep only the top N per source so one source
    // (e.g. SCC Online Blog) can't crowd out the others every run.
    const newest = items
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, MAX_NEWS_PER_SOURCE);
    console.log(`  -> keeping ${newest.length} newest item(s) (cap: ${MAX_NEWS_PER_SOURCE})`);

    allNewsItems = allNewsItems.concat(newest);
  }

  if (allNewsItems.length > 0) {
    const result = appendToPending(NEWS_PENDING_PATH, allNewsItems);
    console.log(
      `[fetch-feeds] news-pending.json updated: +${result.added} added, ${result.skipped} duplicate(s) skipped`
    );
    autoPublishNews(allNewsItems);
  } else {
    console.log("[fetch-feeds] No news items fetched this run.");
  }

  // --- Job sources ---
  let allJobLeadItems = [];
  const rejectedJobs = new Map();
  const now = Date.now();
  for (const source of jobLeads) {
    console.log(`[fetch-feeds] Fetching job source: ${source.name}`);
    const items = await fetchAndParse(source);
    console.log(`  -> ${items.length} item(s) found`);

    const filtered = [];
    for (const item of items) {
      const reason = getJobRejectionReason(item, now);
      if (reason) {
        rejectedJobs.set(reason, (rejectedJobs.get(reason) || 0) + 1);
      } else {
        filtered.push(item);
      }
    }
    console.log(`  -> ${filtered.length} recent legal vacancy announcement(s) kept`);

    const tagged = filtered.map((it) => ({
      ...it,
      isLead: true,
      requiresManualVerification: true,
      sourceNote:
        "Auto-collected lead — confirm the vacancy and details with the employer before applying.",
    }));

    allJobLeadItems = allJobLeadItems.concat(tagged);
  }

  const result = saveRecentJobLeads(allJobLeadItems);
  console.log(
    `[fetch-feeds] jobs-pending.json updated: ${result.count} eligible announcement(s), limited to the last ${JOB_MAX_AGE_DAYS} days`
  );
  if (rejectedJobs.size > 0) {
    console.log(
      `[fetch-feeds] Job feed exclusions: ${[...rejectedJobs]
        .map(([reason, count]) => `${reason}=${count}`)
        .join(", ")}`
    );
  }

  if (allJobLeadItems.length > 0) {
    autoPublishJobListings(allJobLeadItems);
  } else {
    console.log("[fetch-feeds] No job lead items fetched this run.");
    autoPublishJobListings([]);
  }

  console.log(`[fetch-feeds] Run complete at ${new Date().toISOString()}`);
}

run().catch((err) => {
  console.error("[fetch-feeds] Unexpected failure:", err);
  process.exit(1);
});
