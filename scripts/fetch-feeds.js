import { readFile, writeFile } from "node:fs/promises";

const config = JSON.parse(await readFile("scripts/feeds.config.json", "utf8"));

const decode = (s = "") =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1]) : "";
};

const pickLink = (block) => {
  const rss = pick(block, "link");
  if (rss) return rss;
  const atom = block.match(/<link[^>]*href="([^"]+)"/i);
  return atom ? atom[1] : "";
};

function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];
  return blocks.map((b) => ({
    title: pick(b, "title"),
    url: pickLink(b),
    date: pick(b, "pubDate") || pick(b, "published") || pick(b, "updated"),
    summary: pick(b, "description") || pick(b, "summary"),
  }));
}

const matches = (text, keywords) => {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
};

const toISODate = (d) => {
  const parsed = new Date(d);
  return isNaN(parsed) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const loadJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return [];
  }
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "PleadlawFeedBot/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function run() {
  const knownUrls = new Set([
    ...(await loadJson("public/news.json")).map((i) => i.url),
    ...(await loadJson("public/news-pending.json")).map((i) => i.url),
    ...(await loadJson("public/jobs.json")).map((i) => i.applyUrl),
    ...(await loadJson("public/jobs-pending.json")).map((i) => i.applyUrl),
  ]);

  const newsPending = await loadJson("public/news-pending.json");
  const jobsPending = await loadJson("public/jobs-pending.json");

  for (const src of config.news) {
    if (!src.url) continue;
    try {
      const items = parseFeed(await fetchText(src.url));
      for (const it of items) {
        if (!it.url || knownUrls.has(it.url)) continue;
        if (!matches(`${it.title} ${it.summary}`, config.newsKeywords)) continue;
        knownUrls.add(it.url);
        newsPending.push({
          title: it.title,
          source: src.name,
          url: it.url,
          publishedAt: toISODate(it.date),
          category: src.defaultCategory || "General",
          summary: it.summary.slice(0, 200),
        });
      }
    } catch (e) {
      console.error(`News source failed (${src.name}):`, e.message);
    }
  }

  for (const src of config.jobs) {
    if (!src.url) continue;
    try {
      const items = parseFeed(await fetchText(src.url));
      for (const it of items) {
        if (!it.url || knownUrls.has(it.url)) continue;
        if (!matches(`${it.title} ${it.summary}`, config.jobKeywords)) continue;
        knownUrls.add(it.url);
        jobsPending.push({
          title: it.title,
          organisation: src.name,
          location: "Check notification",
          type: src.defaultType || "Other",
          deadline: "",
          applyUrl: it.url,
        });
      }
    } catch (e) {
      console.error(`Job source failed (${src.name}):`, e.message);
    }
  }

  await writeFile("public/news-pending.json", JSON.stringify(newsPending.slice(-100), null, 2));
  await writeFile("public/jobs-pending.json", JSON.stringify(jobsPending.slice(-100), null, 2));
  console.log(`Pending news: ${newsPending.length}, pending jobs: ${jobsPending.length}`);
}

run();
