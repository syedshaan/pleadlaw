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
//
// JOBS: remain pending-only. Nothing here publishes directly to jobs.json.

const fs = require("fs");
const path = require("path");
const https = require("https");

const CONFIG_PATH = path.join(__dirname, "feeds.config.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const NEWS_PENDING_PATH = path.join(PUBLIC_DIR, "news-pending.json");
const JOBS_PENDING_PATH = path.join(PUBLIC_DIR, "jobs-pending.json");
const NEWS_PATH = path.join(PUBLIC_DIR, "news.json");

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

// ---------- helpers ----------

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
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

// ---------- auto-publish logic (news only) ----------

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
// Adjust field names here if news.json's schema differs.
function toPublishedNewsItem(item) {
  return {
    id: item.id,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    summary: item.summary,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    category: item.category,
    publishedAt: new Date().toISOString(),
  };
}

// Auto-publishes qualifying news items straight into news.json.
// Skips items already published (by id) and items that fail the
// safety filter (missing fields or leftover HTML entities).
function autoPublishNews(newItems) {
  const existing = loadJsonSafe(NEWS_PATH, []);
  const existingIds = new Set(existing.map((it) => it.id));

  let publishedCount = 0;
  let skippedDuplicate = 0;
  let skippedUnsafe = 0;

  const toPublish = [];

  for (const item of newItems) {
    if (existingIds.has(item.id)) {
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
    publishedCount++;
  }

  if (toPublish.length > 0) {
    const combined = [...existing, ...toPublish];
    saveJson(NEWS_PATH, combined);
  }

  console.log(
    `[fetch-feeds] news.json auto-publish: +${publishedCount} published, ${skippedDuplicate} duplicate(s) skipped, ${skippedUnsafe} unsafe/incomplete skipped`
  );
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
      sourceName: source.name,
      sourceUrl: raw.sourceUrl || source.url,
      category: source.category,
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
    allNewsItems = allNewsItems.concat(items);
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

  // --- Job lead sources (Google News etc.) ---
  // These are leads only. They are tagged so the reviewer knows to verify
  // against the official source before moving anything into jobs.json.
  let allJobLeadItems = [];
  for (const source of jobLeads) {
    console.log(`[fetch-feeds] Fetching job lead: ${source.name}`);
    const items = await fetchAndParse(source);
    console.log(`  -> ${items.length} item(s) found before keyword filter`);

    const filtered = items.filter((it) =>
      matchesJobKeywords(`${it.title} ${it.summary}`)
    );
    console.log(`  -> ${filtered.length} item(s) matched job keywords`);

    const tagged = filtered.map((it) => ({
      ...it,
      isLead: true,
      requiresManualVerification: true,
      sourceNote:
        "Lead only — verify against the official notice before publishing. Do not copy this link directly into jobs.json.",
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

  console.log(`[fetch-feeds] Run complete at ${new Date().toISOString()}`);
}

run().catch((err) => {
  console.error("[fetch-feeds] Unexpected failure:", err);
  process.exit(1);
});
