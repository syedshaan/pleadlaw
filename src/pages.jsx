import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/* ---------- shared data & helpers ---------- */

const explainers = [
  { slug: "fir-basics", title: "What is an FIR and how do you file one?", summary: "A plain-language guide to filing a First Information Report." },
  { slug: "tenant-rights", title: "Basic tenant rights in India", summary: "Know your rights before signing or ending a rental agreement." },
  { slug: "cheque-bounce", title: "Cheque bounce: what happens under Section 138?", summary: "The steps, timelines and notices involved in a cheque bounce case." },
  { slug: "consumer-complaint", title: "How to file a consumer complaint", summary: "Where and how to complain about defective goods or poor service." },
  { slug: "rti-basics", title: "Using the Right to Information Act", summary: "How to file an RTI application and what to expect." },
];

const isActiveJob = (job) => {
  if (!job.deadline) return true;
  const end = new Date(job.deadline);
  end.setHours(23, 59, 59, 999);
  return end >= new Date();
};

function NewsCard({ item }) {
  const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-IN") : "";
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{item.category}</span>
        <span>{date}</span>
      </div>
      <h3 className="font-semibold leading-snug">{item.title}</h3>
      {item.summary && <p className="mt-2 text-sm text-slate-600">{item.summary}</p>}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{item.source}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
          Read at source →
        </a>
      </div>
    </article>
  );
}

function JobCard({ job }) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{job.title}</h3>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{job.type}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{job.organisation}</p>
      <p className="text-xs text-slate-500">{job.location}</p>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-500">Last date: {job.deadline}</span>
        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
          Official notice →
        </a>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Verify details on the official notification before applying.</p>
    </article>
  );
}

/* ---------- pages ---------- */

export function Home() {
  const [news, setNews] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetch("/news.json").then((r) => r.json()).then(setNews).catch(() => setNews([]));
    fetch("/jobs.json").then((r) => r.json()).then(setJobs).catch(() => setJobs([]));
  }, []);

  const activeJobs = jobs.filter(isActiveJob);

  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Pleadlaw</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
            Indian law news, law jobs, plain-language legal guides, AI drafting support and expert consultations.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/consultation" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-700">Book a Consultation</Link>
            <Link to="/drafter" className="rounded-lg border border-white px-5 py-2.5 font-semibold text-white">Draft a Document</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Law News</h2>
          <Link to="/news" className="text-sm font-medium text-brand-600">View all →</Link>
        </div>
        {news.length === 0 ? <p className="text-slate-500">News will appear here soon.</p> : (
          <div className="grid gap-4 md:grid-cols-3">{news.slice(0, 3).map((n, i) => <NewsCard key={i} item={n} />)}</div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Law Jobs</h2>
          <Link to="/jobs" className="text-sm font-medium text-brand-600">View all →</Link>
        </div>
        {activeJobs.length === 0 ? <p className="text-slate-500">Job listings will appear here soon.</p> : (
          <div className="grid gap-4 md:grid-cols-3">{activeJobs.slice(0, 3).map((j, i) => <JobCard key={i} job={j} />)}</div>
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

export function News() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetch("/news.json").then((r) => r.json()).then(setItems).catch(() => setItems([]));
  }, []);

  const categories = ["All", ...new Set(items.map((i) => i.category))];
  const shown = filter === "All" ? items : items.filter((i) => i.category === filter);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Indian Law News</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === c ? "bg-brand-600 text-white" : "bg-white"}`}>
            {c}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="mt-6 text-slate-500">No news to show yet.</p> : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">{shown.map((n, i) => <NewsCard key={i} item={n} />)}</div>
      )}
    </section>
  );
}

export function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [type, setType] = useState("All");

  useEffect(() => {
    fetch("/jobs.json").then((r) => r.json()).then(setJobs).catch(() => setJobs([]));
  }, []);

  const active = jobs.filter(isActiveJob);
  const types = ["All", ...new Set(active.map((j) => j.type))];
  const shown = type === "All" ? active : active.filter((j) => j.type === type);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Law Jobs in India</h1>
      <p className="mt-2 text-sm text-slate-600">Expired listings are hidden automatically. Always verify details on the official notification.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {types.map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1 text-sm ${type === t ? "bg-brand-600 text-white" : "bg-white"}`}>
            {t}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="mt-6 text-slate-500">No active listings right now.</p> : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">{shown.map((j, i) => <JobCard key={i} job={j} />)}</div>
      )}
    </section>
  );
}

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

export function Consultation() {
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    name: "", age: "", region: "", mobile: "", serviceType: "Legal Consultation", query: "", commPref: "Email",
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
        First consultation: <strong>₹299</strong>. Further consultations are priced by complexity and communicated in advance by email or WhatsApp.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm font-medium">Name *
          <input required name="name" value={form.name} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">Age *
          <input required type="number" min="1" name="age" value={form.age} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">Region
          <input name="region" value={form.region} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">Mobile Number *
          <input required type="tel" name="mobile" value={form.mobile} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">Service Type
          <select name="serviceType" value={form.serviceType} onChange={update} className={field}>
            <option>Career Counselling</option>
            <option>CV Building &amp; Review</option>
            <option>Legal Consultation</option>
            <option>Legal Research &amp; Drafting</option>
          </select>
        </label>
        <label className="block text-sm font-medium">Problem Query
          <textarea name="query" rows={4} value={form.query} onChange={update} className={field} />
        </label>
        <label className="block text-sm font-medium">Preferred communication
          <select name="commPref" value={form.commPref} onChange={update} className={field}>
            <option>Email</option>
            <option>WhatsApp</option>
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span>I have read the disclaimer. Submitting this form does not establish an advocate-client relationship, and the fee is non-refundable.</span>
        </label>

        <button disabled={!agreed} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50">
          Pay ₹299 and Book
        </button>
      </form>
    </section>
  );
}

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
      <p className="mt-2 text-slate-600">Draft fee: <strong>₹299 per draft</strong></p>

      <div className="mt-8 space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm font-medium">Document type
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {docTypes.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Key details
          <textarea rows={6} value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="Parties, dates, amounts, facts..." className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span>I understand this is an AI-generated draft, not legal advice, and that payments are non-refundable.</span>
        </label>

        <button onClick={handleGenerate} disabled={!agreed} className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50">
          Pay ₹299 and Generate Draft
        </button>
      </div>
    </section>
  );
}

export function Policies() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Policies and Disclaimers</h1>
      <p className="mt-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
        Draft text. Must be reviewed by a qualified advocate before publishing.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Disclaimer</h2>
      <p className="mt-2 text-slate-600">
        The content on Pleadlaw is for general information only and is not legal advice. Submitting a form does not
        create an advocate-client relationship. Such a relationship arises only after a professional engagement is
        confirmed in writing.
      </p>

      <h2 className="mt-8 text-xl font-semibold">AI-Generated Drafts</h2>
      <p className="mt-2 text-slate-600">
        Drafts produced by the AI Drafting Assistant may contain errors or omissions and must be reviewed by a
        qualified advocate before use.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Fees and No-Refund Policy</h2>
      <p className="mt-2 text-slate-600">
        The first consultation fee is ₹299 and each AI draft is ₹299. All payments are non-refundable. Fees for
        further consultations and specialised assignments are communicated in advance by email or WhatsApp.
      </p>

      <h2 className="mt-8 text-xl font-semibold">News and Job Listings</h2>
      <p className="mt-2 text-slate-600">
        News and job listings link to third-party sources. Pleadlaw does not guarantee their accuracy. Please
        verify details on the official source before relying on them.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Privacy</h2>
      <p className="mt-2 text-slate-600">
        We collect the details you submit (such as name, age, region, mobile number and query) only to respond
        to your request. Contact us to request correction or deletion of your data.
      </p>
    </section>
  );
}
