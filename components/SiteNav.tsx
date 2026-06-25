"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Live" },
  { href: "/standings", label: "Groups" },
  { href: "/scenarios", label: "What If" },
  { href: "/predict", label: "Predict" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none text-text">FLOODLIT</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted sm:inline">
            tactics-cam
          </span>
        </Link>
        <nav className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-3 py-1.5 transition-colors ${
                  active ? "text-bg" : "text-muted hover:text-text"
                }`}
                style={active ? { background: "var(--accent)" } : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
