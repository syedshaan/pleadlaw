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
    `text-sm font-medium hover:text-brand-600 ${
      isActive ? "text-brand-600" : "text-slate-600"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-brand-700">
          Pleadlaw
        </Link>
        <ul className="hidden gap-5 md:flex">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={linkClass}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <button
          className="rounded border px-3 py-1 text-sm md:hidden"
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
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div>
            <p className="font-semibold text-brand-700">Pleadlaw</p>
            <p className="mt-1 max-w-md">
              Legal information, career guidance and AI drafting support for India.
            </p>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-brand-600">Facebook</a>
            <a href="#" className="hover:text-brand-600">Instagram</a>
            <a href="#" className="hover:text-brand-600">YouTube</a>
            <Link to="/policies" className="hover:text-brand-600">Policies</Link>
          </div>
        </div>
        <p className="mt-6 border-t pt-4 text-xs text-slate-500">
          Content on this website is for general information only and does not constitute legal advice.
          Submitting a consultation form does not by itself establish an advocate-client relationship.
          AI-generated drafts must be reviewed by a qualified advocate. Consultation and drafting fees
          are non-refundable.
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
