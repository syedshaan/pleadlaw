import { useState } from "react";
import { Routes, Route, Link, NavLink } from "react-router-dom";
import {
  Home,
  News,
  Jobs,
  KnowYourLaw,
  Consultation,
  Drafter,
  Policies,
} from "./pages.jsx";

const links = [
  { to: "/news", label: "News" },
  { to: "/jobs", label: "Jobs" },
  { to: "/know-your-law", label: "Know Your Law" },
  { to: "/drafter", label: "AI Drafter" },
  { to: "/consultation", label: "Book Consultation" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }) =>
    `rounded-full px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-violet-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-brand-700"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-sm text-white shadow-md shadow-violet-200">
            P
          </span>
          Pleadlaw
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={linkClass}>
                {l.label}
              </NavLink>
            </li>
          ))}
          <li className="ml-2">
            <Link
              to="/drafter"
              className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Try AI Drafter
            </Link>
          </li>
        </ul>
        <button
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm md:hidden"
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </nav>
      {open && (
        <ul className="space-y-2 border-t bg-white px-4 py-3 md:hidden">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-800 bg-[#11182f] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div>
            <p className="font-bold tracking-wide text-white">Pleadlaw</p>
            <p className="mt-1 max-w-md">
              Legal information, career guidance and AI drafting support for India.
            </p>
          </div>
          <div className="flex gap-4">
            <Link to="/news" className="hover:text-white">News</Link>
            <Link to="/drafter" className="hover:text-white">AI Drafter</Link>
            <Link to="/policies" className="hover:text-white">Policies</Link>
          </div>
        </div>
        <p className="mt-6 border-t border-slate-700 pt-4 text-xs leading-relaxed text-slate-400">
          Content on this website is for general information only and does not constitute legal advice.
          Submitting a consultation form does not by itself establish an advocate-client relationship.
          AI-generated drafts must be reviewed by a qualified advocate. This website does not process
          payments; any professional service fees are communicated in advance.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/news" element={<News />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/know-your-law" element={<KnowYourLaw />} />
          <Route path="/consultation" element={<Consultation />} />
          <Route path="/drafter" element={<Drafter />} />
          <Route path="/policies" element={<Policies />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
