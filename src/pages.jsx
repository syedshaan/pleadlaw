import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DOCUMENT_SCHEMAS, DOCUMENT_TYPES } from "./draft-schema.js";

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

function isRecentJob(posted, now = Date.now()) {
  const timestamp = Date.parse(posted || "");
  const age = now - timestamp;
  return (
    !Number.isNaN(timestamp) &&
    age >= 0 &&
    age <= 10 * 24 * 60 * 60 * 1000
  );
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
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  ).slice(0, 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openJobs = jobs
    .filter(
      (j) =>
        isRecentJob(j.posted) &&
        hasJobSource(j) &&
        (j.sector || j.type) &&
        (!j.lastDate || new Date(j.lastDate) >= today)
    )
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
        <p className="mb-4 text-sm text-slate-500">
          Recent Indian legal recruitment announcements posted within the last 10 days.
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

      <section className="border-t bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
          {[
            { t: "Know Your Law", d: "Plain-language legal explainers.", to: "/know-your-law" },
            { t: "AI Drafting Assistant", d: "Generate a preliminary AI document draft.", to: "/drafter" },
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
      <p className="mt-1 text-xs font-medium text-brand-700">
        Sector: {job.sector || job.type || "Not identified"}
        {Number.isInteger(job.vacancyCount) && ` · Vacancies: ${job.vacancyCount}`}
      </p>
      {job.location && (
        <p className="text-xs text-slate-500">{job.location}</p>
      )}
      {job.description && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {job.description}
        </p>
      )}
      {!job.description && job.autoCollected && (
        <p className="mt-3 text-sm text-slate-500">
          The RSS feed did not include a description. Open the source for full
          vacancy details.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="text-slate-500">
          {job.posted && <p>Posted: {formatDate(job.posted)}</p>}
          {job.lastDate ? (
            <p>Last date to apply: {formatDate(job.lastDate)}</p>
          ) : (
            <p>Application deadline not listed; check the source.</p>
          )}
        </div>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 hover:underline"
          >
            {job.autoCollected ? "Read source article →" : "Official notice →"}
          </a>
        ) : (
          <span className="text-slate-400">Source link unavailable</span>
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
  const recentJobs = data.filter(
    (job) =>
      isRecentJob(job.posted) &&
      hasJobSource(job) &&
      (job.sector || job.type)
  );
  const types = [
    "All",
    ...new Set(recentJobs.map((j) => j.sector || j.type).filter(Boolean)),
  ];

  const items = recentJobs
    .filter((j) => type === "All" || (j.sector || j.type) === type)
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
        Indian government, court, ministry and private legal-sector recruitment announcements
        posted within the last 10 days. Vacancy counts and deadlines appear only when stated
        in the source. Confirm details with the employer before applying.
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
        <p className="mt-6 text-slate-500">
          No recent announcements with a usable source link and identifiable sector yet.
        </p>
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
  const field = "mt-1 w-full rounded-lg border px-3 py-2";

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
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Request a Consultation</h1>
      <p className="mt-2 text-slate-600">
        Tell us how we can help. We will review your request and contact you
        directly. No payment is collected on this website.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Your details and message will be emailed to the Pleadlaw team so they
        can respond. Please do not include passwords or highly sensitive
        documents.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-xl border bg-white p-6"
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
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">AI Drafting Assistant</h1>
      <p className="mt-2 text-slate-600">
        Answer the required questions to create a concise preliminary draft. No payment is
        collected on this page.
      </p>

      <form onSubmit={handleGenerate} className="mt-8 space-y-4 rounded-xl border bg-white p-6">
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
            className="mt-1 w-full rounded-lg border px-3 py-2"
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
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                />
              ) : field.type === "select" ? (
                <select
                  value={formData[field.name] || ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
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
