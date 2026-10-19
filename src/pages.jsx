import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

/* ---------- shared helpers ---------- */

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
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  ).slice(0, 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openJobs = jobs
    .filter((j) => !j.lastDate || new Date(j.lastDate) >= today)
    .sort((a, b) => new Date(b.posted) - new Date(a.posted))
    .slice(0, 3);

  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Pleadlaw</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
            Indian law news, law jobs, plain-language legal guides, AI drafting
            support and expert consultations.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/consultation"
              className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-700"
            >
              Book a Consultation
            </Link>
            <Link
              to="/drafter"
              className="rounded-lg border border-white px-5 py-2.5 font-semibold text-white"
            >
              Draft a Document
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Law News</h2>
          <Link to="/news" className="text-sm font-medium text-brand-600">
            View all →
          </Link>
        </div>
        {latestNews.length === 0 ? (
          <p className="text-slate-500">News will appear here soon.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {latestNews.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Law Jobs</h2>
          <Link to="/jobs" className="text-sm font-medium text-brand-600">
            View all →
          </Link>
        </div>
        {openJobs.length === 0 ? (
          <p className="text-slate-500">Job listings will appear here soon.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {openJobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
          {[
            { t: "Know Your Law", d: "Plain-language legal explainers.", to: "/know-your-law" },
            { t: "AI Drafting Assistant", d: "Document drafts for ₹299 each.", to: "/drafter" },
            { t: "Book a Consultation", d: "First consultation ₹299.", to: "/consultation" },
          ].map((c) => (
            <Link key={c.t} to={c.to} className="rounded-xl border p-5 hover:border-brand-500">
              <h3 className="font-semibold text-brand-700">{c.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{c.d}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------- NEWS ---------- */

function NewsCard({ item }) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        {item.category && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
            {item.category}
          </span>
        )}
        <span>{formatDate(item.date)}</span>
      </div>
      <h3 className="font-semibold leading-snug">{item.title}</h3>
      {item.summary && <p className="mt-2 text-sm text-slate-600">{item.summary}</p>}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Source: {item.source}</span>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-600 hover:underline"
        >
          Read original →
        </a>
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
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Legal News</h1>
      <p className="mt-2 text-slate-600">
        Latest developments in Indian law, linked to the original sources.
      </p>

      <input
        type="text"
        placeholder="Search news..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-6 w-full rounded-lg border px-4 py-2"
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

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </div>
    </section>
  );
}

/* ---------- JOBS ---------- */

function JobCard({ job }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closed = job.lastDate && new Date(job.lastDate) < today;

  return (
    <article className={`rounded-xl border bg-white p-5 shadow-sm ${closed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{job.title}</h3>
        {closed ? (
          <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs">Closed</span>
        ) : (
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {job.autoCollected ? "Auto-collected" : job.verified === false ? "Unverified" : job.type}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {job.organisation || "Employer details in source"}
      </p>
      <p className="text-xs text-slate-500">{job.location}</p>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {job.lastDate ? `Last date: ${formatDate(job.lastDate)}` : ""}
        </span>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 hover:underline"
          >
            {job.autoCollected ? "View source →" : "Official notice →"}
          </a>
        ) : (
          <span className="text-slate-400">Official notice unavailable</span>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        {job.autoCollected
          ? `Collected from ${job.source || "an external source"}. Confirm the vacancy and details with the employer before applying.`
          : "Verify details on the official notification before applying."}
      </p>
    </article>
  );
}

export function Jobs() {
  const { data, loading, error } = useJson("/jobs.json");
  const [type, setType] = useState("All");
  const [query, setQuery] = useState("");
  const types = ["All", ...new Set(data.map((j) => j.type).filter(Boolean))];

  const items = data
    .filter((j) => type === "All" || j.type === type)
    .filter((j) =>
      `${j.title} ${j.organisation || ""} ${j.location || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
    .sort((a, b) => new Date(b.posted) - new Date(a.posted));

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Law Jobs in India</h1>
      <p className="mt-2 text-slate-600">
        Government and legal job openings. Always confirm details on the official notification
        before applying.
      </p>

      <input
        type="text"
        placeholder="Search by post, organisation or location..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-6 w-full rounded-lg border px-4 py-2"
      />

      <div className="mt-4 flex gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1 text-sm ${
              type === t ? "bg-brand-600 text-white" : "bg-white"
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
        <p className="mt-6 text-slate-500">No job listings yet. Please check back soon.</p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Know Your Law</h1>
      <p className="mt-2 text-slate-600">Plain-language explainers on Indian law.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {explainers.map((e) => (
          <article key={e.slug} className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{e.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{e.summary}</p>
            <Link to="/consultation" className="mt-4 inline-block text-sm font-medium text-brand-600">
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
  const [form, setForm] = useState({
    name: "",
    age: "",
    region: "",
    mobile: "",
    serviceType: "Legal Consultation",
    query: "",
    commPref: "Email",
  });

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const field = "mt-1 w-full rounded-lg border px-3 py-2";

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO (Phase 2): create Razorpay order for ₹299 via a serverless function,
    // verify payment via webhook, then save the booking and notify the lawyer.
    alert("Payment integration is not live yet. This is the MVP front end.");
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Book a Consultation</h1>
      <p className="mt-2 text-slate-600">
        First consultation: <strong>₹299</strong>. Further consultations are priced by complexity
        and communicated in advance by email or WhatsApp.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm font-medium">
          Name *
          <input required name="name" value={form.name} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">
          Age *
          <input required type="number" min="1" name="age" value={form.age} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">
          Region
          <input name="region" value={form.region} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">
          Mobile Number *
          <input required type="tel" name="mobile" value={form.mobile} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">
          Service Type
          <select name="serviceType" value={form.serviceType} onChange={update} className={field}>
            <option>Career Counselling</option>
            <option>CV Building &amp; Review</option>
            <option>Legal Consultation</option>
            <option>Legal Research &amp; Drafting</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Problem Query
          <textarea name="query" rows={4} value={form.query} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">
          Preferred communication
          <select name="commPref" value={form.commPref} onChange={update} className={field}>
            <option>Email</option>
            <option>WhatsApp</option>
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I have read the disclaimer. Submitting this form does not establish an
            advocate-client relationship, and the fee is non-refundable.
          </span>
        </label>

        <button
          disabled={!agreed}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          Pay ₹299 and Book
        </button>
      </form>
    </section>
  );
}

/* ---------- AI DRAFTER ---------- */

export function Drafter() {
  const docTypes = [
    "Legal Notice (non-payment / cheque bounce)",
    "Rent / Leave and Licence Agreement",
    "General Affidavit",
    "NDA",
    "Consumer Complaint",
    "RTI Application",
  ];
  const [docType, setDocType] = useState(docTypes[0]);
  const [details, setDetails] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleGenerate = () => {
    // TODO (Phase 2): after Razorpay payment of ₹299 is verified server-side,
    // call the AI API from a serverless function, then return the draft.
    alert("Payment and AI integration are not live yet. This is the MVP front end.");
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">AI Drafting Assistant</h1>
      <p className="mt-2 text-slate-600">
        Draft fee: <strong>₹299 per draft</strong>
      </p>

      <div className="mt-8 space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm font-medium">
          Document type
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            {docTypes.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Key details
          <textarea
            rows={6}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Parties, dates, amounts, facts..."
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand this is an AI-generated draft, not legal advice, and that payments are
            non-refundable.
          </span>
        </label>

        <button
          onClick={handleGenerate}
          disabled={!agreed}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          Pay ₹299 and Generate Draft
        </button>
      </div>
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

      <h2 className="mt-8 text-xl font-semibold">Fees and No-Refund Policy</h2>
      <p className="mt-2 text-slate-600">
        The first consultation fee is ₹299 and each AI draft is ₹299. All payments are
        non-refundable. Fees for further consultations and specialised assignments are communicated
        in advance by email or WhatsApp.
      </p>

      <h2 className="mt-8 text-xl font-semibold">News and Job Listings</h2>
      <p className="mt-2 text-slate-600">
        News and job listings link to third-party sources. Pleadlaw does not guarantee their
        accuracy. Please verify details on the official source before relying on them.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Privacy</h2>
      <p className="mt-2 text-slate-600">
        We collect the details you submit (such as name, age, region, mobile number and query) only
        to respond to your request. Contact us to request correction or deletion of your data.
      </p>
    </section>
  );
}
