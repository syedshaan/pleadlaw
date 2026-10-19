const NEWS_LIVE_PATH = path.join(PUBLIC_DIR, "news.json");
const AUTO_PUBLISH_SOURCES = ["SCC Online Blog", "Bar & Bench"];

function toDateOnly(pubDate) {
  const d = new Date(pubDate);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

function stripBoilerplate(summary) {
  return summary
    .replace(/\s*The post .*? appeared first on SCC Times\.\s*$/i, "")
    .trim();
}

function truncate(text, max = 240) {
  if (text.length <= max) return text;
  return text.slice(0, max).split(" ").slice(0, -1).join(" ") + "...";
}

function guessCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("supreme court")) return "Supreme Court";
  if (/\bhc\b|high court/.test(t)) return "High Courts";
  if (/moot court|call for papers|conference/.test(t)) return "Events";
  if (/notified|notifies|rules|tariff/.test(t)) return "Regulatory";
  if (/advises|law firm/.test(t)) return "Law Firms";
  return "General";
}

function autoPublishNews(items) {
  const live = loadJsonSafe(NEWS_LIVE_PATH, []);
  const liveUrls = new Set(live.map((it) => it.url));
  let nextIdNum =
    live.reduce((max, it) => {
      const m = /^n(\d+)$/.exec(it.id || "");
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) + 1;

  const eligible = items.filter(
    (it) => AUTO_PUBLISH_SOURCES.includes(it.sourceName) && !liveUrls.has(it.link)
  );

  const converted = eligible.map((it) => ({
    id: `n${nextIdNum++}`,
    title: it.title,
    summary: truncate(stripBoilerplate(it.summary)),
    source: it.sourceName,
    url: it.link,
    date: toDateOnly(it.pubDate),
    category: guessCategory(it.title),
  }));

  if (converted.length > 0) {
    saveJson(NEWS_LIVE_PATH, [...live, ...converted]);
    console.log(`[fetch-feeds] Auto-published ${converted.length} item(s) to news.json`);
  } else {
    console.log("[fetch-feeds] No new auto-publishable news items this run.");
  }
}
