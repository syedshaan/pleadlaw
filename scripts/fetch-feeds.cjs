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

const JOB_KEYWORDS = [
  "recruitment",
  "vacancy",
  "vacancies",
  "notification",
  "appointment",
  "judicial",
  "judiciary",
  "exam",
  "interview schedule",
  "law officer",
];

// Matches any leftover numeric or named HTML entity, e.g. &#8377; &#038; &amp;
const HTML_ENTITY_REGEX = /&#?[a-z0-9]+;/i;

// Max new news items taken from each source per run (keeps sources balanced)
const MAX_NEWS_PER_SOURCE = 3;
const MAX_PUBLISHED_NEWS_PER_SOURCE = 5;

// ---------- helpers ----------

function stripHtml(html) {
  if (!html) return "";
  return decodeHtmlEntities(html)
    .replace(/<[^>]*>/g, "")
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

function matchesJobKeywords(text) {
  const lower = (text || "").toLowerCase();
  return JOB_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)
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
      guid: extractTag(block, "guid"),
      sourceUrl: extractAttr(block, "source", "url"),
      sourceName: extractTag(block, "source"),
    });
  }

  return items;
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

// Returns true if the item is safe to publish automatically:
// has a title, has a link, and neither title nor summary contains
// leftover HTML entities (which would indicate a scraping/cleanup issue).
function isSafeToAutoPublish(item) {
  if (!item.title || !item.link) return false;
  if (HTML_ENTITY_REGEX.test(item.title)) return false;
  if (HTML_ENTITY_REGEX.test(item.summary)) return false;
  return true;
}

// Converts a pending-style news item into the shape used in news.json.
// news.json uses: id, title, summary, source, url, date, category.
function toPublishedNewsItem(item) {
  const summary = item.summary || "";
  const publishedAt = new Date(item.pubDate);
  return {
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

  const toPublish = [];

  for (const item of newItems) {
    if (existingIds.has(item.id) || existingUrls.has(item.link)) {
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

  if (balancedItems.length !== existing.length || toPublish.length > 0) {
    saveJson(NEWS_PATH, balancedItems);
  }

  console.log(
    `[fetch-feeds] news.json auto-publish: +${publishedCount} published, ${skippedDuplicate} duplicate(s) skipped, ${skippedUnsafe} unsafe/incomplete skipped, capped at ${MAX_PUBLISHED_NEWS_PER_SOURCE} per source`
  );
}

function toPublishedJob(item) {
  const posted = new Date(item.pubDate);
  const description = getJobDescription(item);
  return {
    id: item.id,
    title: item.title,
    organisation: item.organisation || "",
    type: item.jobType || "Legal vacancy",
    location: item.location || "",
    description,
    posted: Number.isNaN(posted.getTime()) ? "" : posted.toISOString().slice(0, 10),
    lastDate: extractApplicationDeadline(`${item.title} ${item.summary}`, item.pubDate),
    url: item.link,
    verified: false,
    autoCollected: true,
    source: item.sourceName,
  };
}

function getJobDescription(item) {
  let description = (item.summary || "").trim();
  if (description.toLowerCase().startsWith(item.title.toLowerCase())) {
    description = description.slice(item.title.length).replace(/^[\s:—-]+/, "").trim();
  }
  if (description.toLowerCase() === (item.sourceName || "").toLowerCase()) {
    return "";
  }
  return description.length > 450
    ? `${description.slice(0, 447).trimEnd()}...`
    : description;
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
  const existingIds = new Set(existing.map((job) => job.id));
  const existingUrls = new Set(existing.map((job) => job.url).filter(Boolean));
  const toPublish = [];
  let skippedDuplicate = 0;
  let skippedUnsafe = 0;

  for (const item of items) {
    if (existingIds.has(item.id) || existingUrls.has(item.link)) {
      skippedDuplicate++;
      continue;
    }
    if (!isSafeToAutoPublish(item) || !isHttpsUrl(item.link)) {
      skippedUnsafe++;
      console.warn(
        `[fetch-feeds] Skipped job (unsafe/incomplete): "${item.title || "(no title)"}" from ${item.sourceName}`
      );
      continue;
    }
    toPublish.push(toPublishedJob(item));
    existingIds.add(item.id);
    existingUrls.add(item.link);
  }

  if (toPublish.length > 0) {
    saveJson(JOBS_PATH, { jobs: [...existing, ...toPublish] });
  }

  console.log(
    `[fetch-feeds] jobs.json auto-publish: +${toPublish.length} auto-collected, ${skippedDuplicate} duplicate(s) skipped, ${skippedUnsafe} unsafe/incomplete skipped`
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

    return {
      id: makeId(source.name, raw.link, raw.pubDate),
      title: stripHtml(raw.title),
      link: raw.link,
      pubDate: raw.pubDate,
      summary,
      sourceName: stripHtml(raw.sourceName) || source.name,
      sourceUrl: raw.sourceUrl || source.url,
      category: source.category,
      isOfficialSource: source.official === true,
      organisation: source.organisation || "",
      jobType: source.jobType,
      location: source.location,
      fetchedAt: new Date().toISOString(),
    };
  });

  return items;
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
  for (const source of jobLeads) {
    console.log(`[fetch-feeds] Fetching job source: ${source.name}`);
    const items = await fetchAndParse(source);
    console.log(`  -> ${items.length} item(s) found before keyword filter`);

    const filtered = items.filter((it) =>
      source.official === true ||
      matchesJobKeywords(`${it.title} ${it.summary}`)
    );
    console.log(`  -> ${filtered.length} item(s) kept after filtering`);

    const tagged = filtered.map((it) => ({
      ...it,
      isLead: true,
      requiresManualVerification: true,
      sourceNote:
        "Auto-collected lead — confirm the vacancy and details with the employer before applying.",
    }));

    allJobLeadItems = allJobLeadItems.concat(tagged);
  }

  if (allJobLeadItems.length > 0) {
    const result = appendToPending(JOBS_PENDING_PATH, allJobLeadItems);
    console.log(
      `[fetch-feeds] jobs-pending.json updated: +${result.added} added, ${result.skipped} duplicate(s) skipped`
    );
  } else {
    console.log("[fetch-feeds] No job lead items fetched this run.");
  }

  if (allJobLeadItems.length > 0) {
    autoPublishJobListings(allJobLeadItems);
  } else {
    console.log("[fetch-feeds] No job listings to publish.");
  }

  console.log(`[fetch-feeds] Run complete at ${new Date().toISOString()}`);
}

run().catch((err) => {
  console.error("[fetch-feeds] Unexpected failure:", err);
  process.exit(1);
});
