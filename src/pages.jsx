import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DOCUMENT_SCHEMAS, DOCUMENT_TYPES } from "./draft-schema.js";

/* ---------- shared helpers ---------- */

const JOB_MAX_AGE_DAYS = 20;
const MAX_JOB_RESULTS = 50;
const MIN_PREFERRED_JOB_RESULTS = 20;
const MAX_JOB_VACANCIES = 2000;

const explainers = [
  {
    slug: "fir-basics",
    title: "What is an FIR and how do you file one?",
    summary: "A plain-language guide to filing a First Information Report.",
  },
  {
    slug: "tenant-rights",
    title: "Basic tenant rights in India",
    summary: "Know your rights before signing or ending a rental agreement.",
  },
  {
    slug: "cheque-bounce",
    title: "Cheque bounce: what happens under Section 138?",
    summary: "The steps, timelines and notices involved in a cheque bounce case.",
  },
  {
    slug: "consumer-complaint",
    title: "How to file a consumer complaint",
    summary: "Where and how to complain about defective goods or poor service.",
  },
  {
    slug: "rti-basics",
    title: "Using the Right to Information Act",
    summary: "How to file an RTI application and what to expect.",
  },
];

// Loads a JSON file from /public. Returns { data, loading, error }.
function useJson(path) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => {
        setData(Array.isArray(d) ? d : Array.isArray(d?.jobs) ? d.jobs : []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [path]);

  return { data, loading, error };
}

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isRecentJob(posted, now = Date.now()) {
  const timestamp = Date.parse(posted || "");
  const age = now - timestamp;
  return (
    !Number.isNaN(timestamp) &&
    age >= 0 &&
    age <= JOB_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );
}

function isSpecificLegalJobTitle(title = "") {
  return /\b(?:spa|jca)\b|\b(?:law|legal)\s+(?:officers?|assistants?|associates?|internships?|interns?|researchers?|research associates?|clerks?|consultants?|advisers?|advisors?|counsel|executives?|managers?|faculty|professors?|lecturers?|fellows?|analysts?|secretaries|trainees?|jobs?|vacanc(?:y|ies))\b|\b(?:advocates?|lawyers?|paralegals?|prosecutors?|solicitors?|barristers?)\b|\b(?:judicial services?|civil judges?|district judges?|judicial magistrates?|court (?:assistants?|clerks?|masters?|readers?|typists?|stenographers?|officers?|interpreters?|translators?))\b/i.test(title);
}

function isRelevantJob(job) {
  const title = job.title || "";
  const context = `${job.organisation || ""} ${job.source || ""} ${job.sector || job.type || ""}`;
  const combined = `${title} ${context}`;
  return (
    isSpecificLegalJobTitle(title) ||
    (/\b(?:law|legal|policy)\s+internships?\b|\blegal\s+interns?\b/i.test(combined)) ||
    (/\b(?:ministry|ministries|government|govt\.?)\b/i.test(combined) &&
      /\b(?:assistant professors?|professors?|lecturers?|faculty|internships?|interns?|officers?|assistants?|associates?|consultants?|analysts?|managers?|executives?|researchers?|fellows?|teachers?|deans?)\b/i.test(title)) ||
    (/\b(?:big\s*four|deloitte|pwc|pricewaterhousecoopers|ey|ernst\s*(?:and|&)\s*young|kpmg)\b/i.test(combined) &&
      /\b(?:legal|law|tax|audit|compliance|risk|forensic|internships?|interns?|consultants?|analysts?|associates?)\b/i.test(title)) ||
    (/\b(?:government|govt\.?|central|state)\b/i.test(combined) &&
      /\b(?:college|university|institute)\b/i.test(combined) &&
      /\b(?:law|legal)\b/i.test(combined) &&
      /\b(?:assistant professors?|professors?|lecturers?|faculty|deans?)\b/i.test(title))
  );
}

function compareJobsByVacancyCount(a, b) {
  const vacanciesA = Number.isInteger(a.vacancyCount) ? a.vacancyCount : 0;
  const vacanciesB = Number.isInteger(b.vacancyCount) ? b.vacancyCount : 0;
  return vacanciesB - vacanciesA || new Date(b.posted) - new Date(a.posted);
}

function isPreferredJob(job) {
  return /\b(?:internships?|interns?|ministry|ministries|government|govt\.?|big\s*four|deloitte|pwc|pricewaterhousecoopers|ey|ernst\s*(?:and|&)\s*young|kpmg)\b/i.test(
    `${job.title || ""} ${job.organisation || ""} ${job.source || ""} ${job.sector || job.type || ""}`
  ) || (
    /\b(?:government|govt\.?|central|state)\b/i.test(
      `${job.title || ""} ${job.organisation || ""} ${job.source || ""} ${job.sector || job.type || ""}`
    ) &&
    /\b(?:college|university|institute)\b/i.test(
      `${job.title || ""} ${job.organisation || ""} ${job.source || ""} ${job.sector || job.type || ""}`
    ) &&
    /\b(?:assistant professors?|professors?|lecturers?|faculty|deans?)\b/i.test(job.title || "")
  );
}

function jobTitleTokens(title) {
  const ignored = new Set([
    "a", "an", "and", "application", "applications", "apply", "at", "date",
    "eligibility", "fast", "for", "from", "here", "how", "in", "india", "jobs",
    "news", "notification", "now", "of", "online", "open", "opening", "openings",
    "out", "post", "posts", "recruitment", "rs", "salary", "starts", "the",
    "times", "to", "up", "vacancies", "vacancy", "via", "check",
    "collegeapply", "adda", "adda247", "freejobalert", "sarkariresult", "sci",
    "2026", "2025",
  ]);
  return new Set(
    (title || "")
      .toLowerCase()
      .replace(/\bspa\b/g, "senior personal assistant")
      .replace(/\bjca\b/g, "junior court assistant")
      .replace(/\b[a-z0-9-]+\.(?:gov|com|org|net)(?:\.[a-z]{2,})*\b/gi, " ")
      .replace(/\b\d[\d,]*\b/g, " ")
      .replace(/[^a-z]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !ignored.has(token))
  );
}

function deduplicateJobs(jobs) {
  const selected = [];
  const seenVacancyCounts = new Set();
  for (const job of [...jobs].sort((a, b) =>
    Number(isPreferredJob(b)) - Number(isPreferredJob(a)) ||
    compareJobsByVacancyCount(a, b)
  )) {
    if (
      Number.isInteger(job.vacancyCount) &&
      job.vacancyCount > 0 &&
      (job.vacancyCount > MAX_JOB_VACANCIES ||
        seenVacancyCounts.has(job.vacancyCount))
    ) {
      continue;
    }
    const tokens = jobTitleTokens(job.title);
    const duplicate = selected.some((existing) => {
      const employerTokens = jobTitleTokens(job.organisation);
      const existingEmployerTokens = jobTitleTokens(existing.organisation);
      if (employerTokens.size && existingEmployerTokens.size) {
        const sharedEmployers = [...employerTokens].filter((token) =>
          existingEmployerTokens.has(token)
        ).length;
        const smallerEmployerSize = Math.min(
          employerTokens.size,
          existingEmployerTokens.size
        );
        if (sharedEmployers / smallerEmployerSize < 0.6) return false;
      }

      const existingTokens = jobTitleTokens(existing.title);
      const shared = [...tokens].filter((token) => existingTokens.has(token)).length;
      const combinedLength = tokens.size + existingTokens.size - shared;
      return shared >= 3 && combinedLength > 0 && shared / combinedLength >= 0.55;
    });
    if (!duplicate) {
      selected.push(job);
      if (Number.isInteger(job.vacancyCount)) {
        seenVacancyCounts.add(job.vacancyCount);
      }
    }
  }
  return selected;
}

function selectJobResults(jobs) {
  const preferred = jobs.filter(isPreferredJob).sort(compareJobsByVacancyCount);
  const other = jobs.filter((job) => !isPreferredJob(job)).sort(compareJobsByVacancyCount);
  return [
    ...preferred.slice(0, MIN_PREFERRED_JOB_RESULTS),
    ...other,
    ...preferred.slice(MIN_PREFERRED_JOB_RESULTS),
  ].slice(0, MAX_JOB_RESULTS).sort(compareJobsByVacancyCount);
}

function hasJobSource(job) {
  try {
    return Boolean(job.url) && new URL(job.url).protocol === "https:";
  } catch {
    return false;
  }
}

function diversifyBySource(items) {
  const sources = new Map();
  for (const item of items) {
    const source = item.source || "Unknown";
    if (!sources.has(source)) sources.set(source, []);
    sources.get(source).push(item);
  }

  const diversified = [];
  let hasItems = true;
  while (hasItems) {
    hasItems = false;
    for (const sourceItems of sources.values()) {
      const item = sourceItems.shift();
      if (item) {
        diversified.push(item);
        hasItems = true;
      }
    }
  }
  return diversified;
}

/* ---------- HOME ---------- */

export function Home() {
  const { data: news } = useJson("/news.json");
  const { data: jobs } = useJson("/jobs.json");

  const latestNews = diversifyBySource([...news]
    .filter((item) => item.image)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  ).slice(0, 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openJobs = deduplicateJobs(jobs
    .filter(
      (j) =>
        isRecentJob(j.posted) &&
        (!j.autoCollected || isRelevantJob(j)) &&
        hasJobSource(j) &&
        (j.sector || j.type) &&
        (!Number.isInteger(j.vacancyCount) ||
          (j.vacancyCount > 0 && j.vacancyCount <= MAX_JOB_VACANCIES)) &&
        (!j.lastDate || new Date(j.lastDate) >= today)
    )
    .sort(compareJobsByVacancyCount)
  ).slice(0, 3);

  return (
    <>
      <section className="hero-glow relative isolate overflow-hidden text-white">
        <div className="absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full border border-white/10 bg-white/[0.03] blur-[1px]" />
        <div className="absolute right-24 top-28 -z-10 h-40 w-40 rounded-full border border-cyan-200/20" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
              Next-generation legal services
            </span>
            <h1 className="mt-6 max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
              The law, made
              <span className="block bg-gradient-to-r from-cyan-200 via-violet-200 to-white bg-clip-text text-transparent">
                easier to navigate.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-indigo-100/85">
              Explore Indian legal updates and career opportunities, and create a preliminary document draft through guided, document-specific questions.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/consultation"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-cyan-50"
            >
              Talk to our team
            </Link>
            <Link
              to="/drafter"
              className="rounded-xl border border-white/25 bg-white/[0.06] px-5 py-3 font-semibold text-white transition hover:bg-white/15"
            >
              Explore AI drafting
            </Link>
          </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-indigo-100/70">
              <span>AI-assisted drafting</span>
              <span>·</span>
              <span>Indian law news</span>
              <span>·</span>
              <span>Career resources</span>
            </div>
          </div>
          <Link
            to="/drafter"
            className="group relative mx-auto block w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl transition hover:-translate-y-1"
          >
            <div className="rounded-2xl bg-gradient-to-br from-white to-indigo-50 p-6 text-slate-900">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-800">
                  AI Draft Studio
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg text-white">✦</span>
              </div>
              <div className="mt-7 space-y-3">
                <div className="h-2.5 w-3/4 rounded-full bg-slate-200" />
                <div className="h-2 w-full rounded-full bg-slate-100" />
                <div className="h-2 w-5/6 rounded-full bg-slate-100" />
                <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Structured. Clear. Reviewed.</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Build a preliminary document draft with guided questions for your document type.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 pt-4 text-sm text-white/85">
              <span>Start a guided draft</span>
              <span className="transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-16">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Stay informed</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Latest law news</h2>
          </div>
          <Link to="/news" className="text-sm font-semibold text-brand-700 hover:text-brand-500">
            View all →
          </Link>
        </div>
        {latestNews.length === 0 ? (
          <p className="text-slate-500">Photo news will appear here when publishers provide images.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {latestNews.map((n) => (
              <NewsCard key={n.id} item={n} requireImage />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Build your future</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Latest law jobs</h2>
          </div>
          <Link to="/jobs" className="text-sm font-semibold text-brand-700 hover:text-brand-500">
            View all →
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Recent Indian legal job and internship listings posted within the last {JOB_MAX_AGE_DAYS} days.
        </p>
        {openJobs.length === 0 ? (
          <p className="text-slate-500">
            No recent announcements with a usable source link and identifiable sector yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {openJobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-slate-200 bg-white/80">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 md:grid-cols-3 md:px-6">
          {[
            { t: "Know Your Law", d: "Understand legal topics in plain language.", to: "/know-your-law", icon: "01" },
            { t: "AI Drafting Assistant", d: "Create a preliminary document draft with guided prompts.", to: "/drafter", icon: "02" },
            { t: "Book a Consultation", d: "Tell us what you need and our team will reach out.", to: "/consultation", icon: "03" },
          ].map((c) => (
            <Link key={c.t} to={c.to} className="surface-card rounded-2xl p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-brand-700">{c.icon}</span>
              <h3 className="mt-5 font-bold text-slate-900">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.d}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-brand-700">Explore →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------- NEWS ---------- */

function NewsArtwork({ item, onImageError }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="news-art relative aspect-[16/9] overflow-hidden">
      {item.image && !imageFailed ? (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setImageFailed(true);
            onImageError?.();
          }}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
          <span className="w-fit rounded-full border border-white/25 bg-slate-950/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur">
            {item.category || "Legal update"}
          </span>
          <div>
            <div className="mb-2 h-px w-12 bg-cyan-200/80" />
            <p className="max-w-xs text-lg font-semibold leading-snug text-white/95">Law, policy &amp; justice</p>
          </div>
          <span className="absolute right-5 top-3 text-7xl font-black text-white/[0.12]">§</span>
        </div>
      )}
    </div>
  );
}

function NewsCard({ item, requireImage = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (requireImage && (!item.image || imageFailed)) return null;

  return (
    <article className="surface-card group overflow-hidden rounded-2xl">
      <NewsArtwork item={item} onImageError={() => setImageFailed(true)} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-brand-700">
            {item.category || "Legal news"}
          </span>
          <span>{formatDate(item.date)}</span>
        </div>
        <h3 className="line-clamp-3 font-bold leading-snug text-slate-900">{item.title}</h3>
        {item.summary && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.summary}</p>}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
          <span className="truncate text-slate-500">{item.source}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-semibold text-brand-700 hover:text-brand-500"
          >
            Read story →
          </a>
        </div>
      </div>
    </article>
  );
}

export function News() {
  const { data, loading, error } = useJson("/news.json");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const categories = ["All", ...new Set(data.map((n) => n.category).filter(Boolean))];

  const items = diversifyBySource(data
    .filter((n) => category === "All" || n.category === category)
    .filter((n) =>
      `${n.title} ${n.summary || ""}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date)));

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-10 text-white md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Pleadlaw briefing</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">Legal news, clearly.</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-indigo-100/80">
        Latest developments in Indian law, linked to the original sources.
        </p>
      </div>

      <input
        type="text"
        placeholder="Search news..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-6 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === c ? "bg-brand-600 text-white" : "bg-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6">Loading...</p>}
      {error && (
        <p className="mt-6 text-red-600">Could not load news. Please try again later.</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-6 text-slate-500">No news items yet. Please check back soon.</p>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </div>
    </section>
  );
}

/* ---------- JOBS ---------- */

function JobArtwork({ job }) {
  const [imageFailed, setImageFailed] = useState(false);

  const artwork = (
    <div className="news-art relative -mx-4 -mt-4 mb-4 aspect-[16/9] overflow-hidden">
      {job.image && !imageFailed && (
        <img
          src={job.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-indigo-950/75 to-violet-900/45" />
      <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
        <span className="w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100 backdrop-blur">
          Legal career opportunity
        </span>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-indigo-100/80">
              {job.sector || job.type || "Career opening"}
            </p>
            <p className="mt-1 text-xl font-bold leading-tight">
              {Number.isInteger(job.vacancyCount)
                ? `${job.vacancyCount.toLocaleString("en-IN")} openings`
                : "Your next opportunity"}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg transition group-hover:translate-x-1 group-hover:bg-white/20">
            →
          </span>
        </div>
      </div>
      {!job.image && (
        <span className="pointer-events-none absolute right-5 top-10 text-8xl font-black leading-none text-white/[0.08]">
          §
        </span>
      )}
    </div>
  );

  if (!job.url) return artwork;

  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View opportunity: ${job.title}`}
      className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
    >
      {artwork}
    </a>
  );
}

function JobCard({ job }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closed = job.lastDate && new Date(job.lastDate) < today;

  return (
    <article className={`surface-card group overflow-hidden rounded-2xl p-4 ${closed ? "opacity-60" : ""}`}>
      <JobArtwork job={job} />
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-bold leading-snug text-slate-900">{job.title}</h3>
        {closed ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Closed</span>
        ) : !job.autoCollected && job.verified === false ? (
          <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            Unverified
          </span>
        ) : null}
      </div>
      {job.organisation && (
        <p className="mt-2 line-clamp-1 text-sm text-slate-600">{job.organisation}</p>
      )}
      <p className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold text-brand-700">
        <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">
          {job.sector || job.type || "Legal opportunity"}
        </span>
        {Number.isInteger(job.vacancyCount) && (
          <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            Vacancies: {job.vacancyCount.toLocaleString("en-IN")}
          </span>
        )}
      </p>
      {job.location && (
        <p className="mt-2 line-clamp-1 text-xs text-slate-500">{job.location}</p>
      )}
      {job.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {job.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
        <div className="text-slate-500">
          {job.posted && <p>Posted {formatDate(job.posted)}</p>}
          {job.lastDate && <p>Apply by {formatDate(job.lastDate)}</p>}
        </div>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-700 hover:text-brand-500"
          >
            {job.autoCollected ? "Read source article →" : "Official notice →"}
          </a>
        ) : (
          <span className="text-slate-400">Source link unavailable</span>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Confirm the vacancy and application details with the employer before applying.
      </p>
    </article>
  );
}

export function Jobs() {
  const { data, loading, error } = useJson("/jobs.json");
  const [type, setType] = useState("All");
  const [query, setQuery] = useState("");
  const recentJobs = deduplicateJobs(data.filter(
    (job) =>
      isRecentJob(job.posted) &&
      (!job.autoCollected || isRelevantJob(job)) &&
      hasJobSource(job) &&
      (job.sector || job.type) &&
      (!Number.isInteger(job.vacancyCount) ||
        (job.vacancyCount > 0 && job.vacancyCount <= MAX_JOB_VACANCIES))
  ));
  const types = [
    "All",
    ...new Set(recentJobs.map((j) => j.sector || j.type).filter(Boolean)),
  ];

  const filteredJobs = recentJobs
    .filter((j) => type === "All" || (j.sector || j.type) === type)
    .filter((j) =>
      `${j.title} ${j.organisation || ""} ${j.location || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  const items = type === "All" && !query
    ? selectJobResults(filteredJobs)
    : filteredJobs.sort(compareJobsByVacancyCount).slice(0, MAX_JOB_RESULTS);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-10 text-white md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Career opportunities</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">Law jobs in India</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-indigo-100/80">
        Indian legal jobs and internships posted within the last {JOB_MAX_AGE_DAYS} days.
        Showing up to {MAX_JOB_RESULTS} results, including at least {MIN_PREFERRED_JOB_RESULTS} opportunities
        from internships, ministries, Big Four firms, and government law colleges when available.
        Only postings reporting a unique vacancy count up to {MAX_JOB_VACANCIES} are shown.
        Vacancy counts and deadlines appear only
        when stated in the source. Confirm details with the employer before applying.
        </p>
      </div>

      <input
        type="text"
        placeholder="Search by post, organisation or location..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-6 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              type === t ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6">Loading...</p>}
      {error && (
        <p className="mt-6 text-red-600">Could not load jobs. Please try again later.</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-6 text-slate-500">
          No recent announcements with a usable source link and identifiable sector yet.
        </p>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}

/* ---------- KNOW YOUR LAW ---------- */

export function KnowYourLaw() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-10 text-white md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Legal essentials</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">Know your law</h1>
        <p className="mt-3 text-indigo-100/80">Plain-language explainers on Indian law.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {explainers.map((e) => (
          <article key={e.slug} className="surface-card rounded-2xl p-6">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Plain-language guide</span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">{e.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{e.summary}</p>
            <Link to="/consultation" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:text-brand-500">
              Need help with this? Book a consultation →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- CONSULTATION ---------- */

export function Consultation() {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    name: "",
    age: "",
    region: "",
    mobile: "",
    email: "",
    serviceType: "Legal Consultation",
    query: "",
    commPref: "Email",
    website: "",
  });

  const update = (e) => {
    setSubmitStatus("");
    setSubmitError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const field =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitStatus("");

    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent: agreed }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "We could not send your request.");
      }
      setSubmitStatus(
        "Your request has been sent. The website owner will contact you using your preferred method."
      );
      setForm({
        name: "",
        age: "",
        region: "",
        mobile: "",
        email: "",
        serviceType: "Legal Consultation",
        query: "",
        commPref: "Email",
        website: "",
      });
      setAgreed(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not send your request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-9 text-white md:px-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Personal support</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Request a consultation</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-indigo-100/80">
        Tell us how we can help. We will review your request and contact you
        directly. No payment is collected on this website.
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Your details and message will be emailed to the Pleadlaw team so they
        can respond. Please do not include passwords or highly sensitive
        documents.
      </p>

      <form
        onSubmit={handleSubmit}
        className="surface-card mt-8 space-y-5 rounded-2xl p-6 md:p-8"
      >
        <label className="block text-sm font-medium">
          Name *
          <input
            required
            maxLength={100}
            autoComplete="name"
            name="name"
            value={form.name}
            onChange={update}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          Age *
          <input
            required
            type="number"
            min="1"
            max="120"
            name="age"
            value={form.age}
            onChange={update}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          City / State *
          <input
            required
            maxLength={120}
            autoComplete="address-level1"
            name="region"
            value={form.region}
            onChange={update}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          Mobile Number *
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="(?:\+?91[\s-]?)?[6-9]\d{9}"
            title="Enter a valid 10-digit Indian mobile number, optionally with +91."
            maxLength={16}
            name="mobile"
            value={form.mobile}
            onChange={update}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          Email Address *
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            name="email"
            value={form.email}
            onChange={update}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          Service Type *
          <select name="serviceType" value={form.serviceType} onChange={update} className={field}>
            <option>Career Counselling</option>
            <option>CV Building &amp; Review</option>
            <option>Legal Consultation</option>
            <option>Legal Research &amp; Drafting</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          How can we help? *
          <textarea
            required
            minLength={10}
            maxLength={5000}
            name="query"
            rows={5}
            value={form.query}
            onChange={update}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          Preferred way to contact you *
          <select name="commPref" value={form.commPref} onChange={update} className={field}>
            <option>Email</option>
            <option>WhatsApp</option>
          </select>
        </label>

        <div className="hidden" aria-hidden="true">
          <label>
            Leave this field empty
            <input
              tabIndex="-1"
              autoComplete="off"
              name="website"
              value={form.website}
              onChange={update}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            required
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree that my details will be emailed to the Pleadlaw team to
            respond to this request. I understand that submitting this form
            does not create an advocate-client relationship.
          </span>
        </label>

        {submitError && (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
          </p>
        )}
        {submitStatus && (
          <p role="status" className="text-sm text-green-700">
            {submitStatus}
          </p>
        )}

        <button
          type="submit"
          disabled={!agreed || isSubmitting}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Sending request..." : "Send consultation request"}
        </button>
      </form>
    </section>
  );
}

/* ---------- AI DRAFTER ---------- */

export function Drafter() {
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [formData, setFormData] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const fields = DOCUMENT_SCHEMAS[docType].fields;

  const updateField = (name, value) => {
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError("");
    setDraft("");

    if (!agreed) {
      setError("Please check the consent box before generating the draft.");
      return;
    }

    const incompleteField = fields.find(
      (field) =>
        !formData[field.name]?.trim() ||
        (field.minLength && formData[field.name].trim().length < field.minLength)
    );
    if (incompleteField) {
      setError(`Please complete "${incompleteField.label}" before generating the draft.`);
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/draft-petition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          fields: Object.fromEntries(
            fields.map(({ name }) => [name, formData[name] || ""])
          ),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to generate a draft right now.");
      }
      setDraft(result.draft);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Could not reach the draft-generation endpoint. Check your connection and confirm the latest deployment includes /api/draft-petition. If it continues, check the Vercel Function logs."
          : requestError instanceof Error
            ? requestError.message
            : "Unable to generate a draft right now."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-9 text-white md:px-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Pleadlaw AI Studio</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Guided document drafting for India</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-indigo-100/80">
          Choose a document type and answer questions designed for that document. The AI uses
          the details you provide to prepare a preliminary draft; it does not determine the
          correct court, jurisdiction, or legal strategy.
        </p>
        <div className="mt-6 grid gap-3 text-sm text-white/90 sm:grid-cols-3">
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
            <p className="font-semibold text-cyan-100">Document-specific questions</p>
            <p className="mt-1 text-white/70">Prompts change with the selected document type.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
            <p className="font-semibold text-cyan-100">Your facts, your review</p>
            <p className="mt-1 text-white/70">Check every detail and have the draft reviewed.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
            <p className="font-semibold text-cyan-100">You confirm the forum</p>
            <p className="mt-1 text-white/70">The tool does not decide court jurisdiction.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="surface-card space-y-5 rounded-2xl p-6 md:p-8">
        <label htmlFor="draft-document-type" className="block text-sm font-medium">
          Document type
          <select
            id="draft-document-type"
            value={docType}
            onChange={(e) => {
              setDocType(e.target.value);
              setFormData({});
              setDraft("");
              setError("");
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          >
            {DOCUMENT_TYPES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>

        <div key={docType} className="space-y-4">
          <h2 className="text-lg font-semibold">
            Questions for: {docType}
          </h2>
          {fields.map((field) => (
            <label key={field.name} className="block text-sm font-medium">
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  rows={4}
                  value={formData[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value.slice(0, field.maxLength))}
                  placeholder={field.placeholder}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  required
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                />
              ) : field.type === "select" ? (
                <select
                  value={formData[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  required
                >
                  <option value="">Select an option</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value.slice(0, field.maxLength))}
                  placeholder={field.placeholder}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                  maxLength={field.maxLength}
                />
              )}
              {field.helpText && (
                <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">
                  {field.helpText}
                </span>
              )}
            </label>
          ))}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand this is an AI-generated draft, not legal advice. I consent to sending
            these details to Google Gemini to generate the draft and will have it reviewed by a
            qualified advocate before use.
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {isGenerating ? "Generating draft..." : "Generate Draft"}
        </button>
      </form>

      {draft && (
        <div className="mt-6 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Generated draft</h2>
          <textarea
            aria-label="Generated draft"
            readOnly
            rows={18}
            value={draft}
            className="mt-3 w-full rounded-lg border px-3 py-2"
          />
          <p className="mt-2 text-sm text-amber-800">
            This is a preliminary AI-generated draft, not legal advice. Verify all facts, laws,
            citations, and court requirements with a qualified advocate before use.
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- POLICIES ---------- */

export function Policies() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Policies and Disclaimers</h1>
      <p className="mt-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
        Draft text. Must be reviewed by a qualified advocate before publishing.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Disclaimer</h2>
      <p className="mt-2 text-slate-600">
        The content on Pleadlaw is for general information only and is not legal advice. Submitting
        a form does not create an advocate-client relationship. Such a relationship arises only
        after a professional engagement is confirmed in writing.
      </p>

      <h2 className="mt-8 text-xl font-semibold">AI-Generated Drafts</h2>
      <p className="mt-2 text-slate-600">
        Drafts produced by the AI Drafting Assistant may contain errors or omissions and must be
        reviewed by a qualified advocate before use.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Fees</h2>
      <p className="mt-2 text-slate-600">
        This website does not process payments. Any professional service fees will be communicated
        and agreed in advance by email or WhatsApp.
      </p>

      <h2 className="mt-8 text-xl font-semibold">News and Job Listings</h2>
      <p className="mt-2 text-slate-600">
        News and job listings link to third-party sources. Pleadlaw does not guarantee their
        accuracy. Please verify details on the official source before relying on them.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Privacy</h2>
      <p className="mt-2 text-slate-600">
        We collect the details you submit (such as name, age, region, mobile number and query) only
        to respond to your request. Details entered in the AI Drafter are sent to Google Gemini to
        generate a draft and are not saved by this website. Avoid submitting unnecessary personal
        or confidential information. Contact us to request correction or deletion of consultation
        data.
      </p>
    </section>
  );
}
