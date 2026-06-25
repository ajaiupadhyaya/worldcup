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
    <header className="border-b border-border bg-bg/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-stretch justify-between px-4">
        <Link href="/" className="group flex shrink-0 items-center gap-3 border-l border-border pl-3 pr-4 sm:pr-5">
          <span className="font-display text-[28px] leading-none text-text">FLOODLIT</span>
          <span className="hidden border-l border-border pl-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted sm:inline">
            atlas
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-stretch justify-end overflow-x-auto font-mono text-[11px] uppercase tracking-[0.16em] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center border-l border-border px-3 py-4 transition-colors last:border-r ${
                  active ? "bg-text text-bg" : "text-muted hover:bg-surface hover:text-text"
                }`}
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
