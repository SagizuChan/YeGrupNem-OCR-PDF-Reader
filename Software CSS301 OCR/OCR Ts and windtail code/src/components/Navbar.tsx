"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left: brand + tools */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-white">
            OCR PDF Reader
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/image-to-text" className="nav-link">Image to Text</Link>
            <Link href="/compress-pdf" className="nav-link">Compress PDF</Link>

            {/* Obvious dropdown button */}
            <div className="relative" ref={ref}>
              <button
                className="btn-dropdown"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="others-menu"
                onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
              >
                Others
                <svg
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" />
                </svg>
              </button>
              {open && (
                <div
                  id="others-menu"
                  role="menu"
                  className="absolute left-0 mt-2 w-48 rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-lg"
                >
                  <a className="menu-item" role="menuitem" href="#">Placeholder 1</a>
                  <a className="menu-item" role="menuitem" href="#">Placeholder 2</a>
                  <a className="menu-item" role="menuitem" href="#">Placeholder 3</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: auth */}
        <div className="flex items-center gap-4">
          <Link href="/login" className="nav-link">Log in</Link>
          <Link href="/register" className="btn-primary">Sign up</Link>
        </div>
      </nav>
    </header>
  );
}