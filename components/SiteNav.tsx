"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "HOME" },
  { href: "/#fixtures", label: "MATCHES" },
  { href: "/standings", label: "STANDINGS" },
  { href: "/predict", label: "PREDICT" },
  { href: "/scenarios", label: "SCENARIOS" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();
  const today = new Date()
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-strong)] bg-[var(--background)]">
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between px-6 sm:px-12">
        <Link href="/" className="font-heading text-[22px] font-bold text-[var(--foreground)]">
          WC
        </Link>
        <nav className="flex min-w-0 flex-1 items-center justify-end gap-6 overflow-x-auto md:gap-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 text-[11px] tracking-[2px] transition-colors ${
                  active ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span className="hidden shrink-0 text-[10px] tracking-[1.5px] text-[var(--foreground-secondary)] lg:inline">
          {today}
        </span>
      </div>
    </header>
  );
}
