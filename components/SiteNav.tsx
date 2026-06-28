"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "INDEX" },
  { href: "/#fixtures", label: "FIXTURES" },
  { href: "/standings", label: "TABLES" },
  { href: "/predict", label: "FORECAST" },
  { href: "/bracket", label: "THE DRAW" },
  { href: "/scenarios", label: "SCENARIOS" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();
  // Pinned editorial dateline timezone keeps server (UTC) and client (local)
  // identical — avoids a React #418 hydration mismatch near midnight.
  const today = new Date()
    .toLocaleDateString("en-GB", {
      timeZone: "America/New_York",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-strong)] bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="h-[2px] w-full bg-[var(--foreground-accent)]" />
      <div className="mx-auto flex h-[58px] max-w-[1480px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="group flex shrink-0 items-baseline gap-2 leading-none">
          <span className="font-heading text-[24px] font-black italic tracking-[-0.03em] text-[var(--foreground)] misreg-soft">
            WC
          </span>
          <span className="hidden text-[8px] tracking-[0.3em] text-[var(--foreground-secondary)] sm:inline">
            MMXXVI
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-5 overflow-x-auto md:gap-9 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`group relative shrink-0 py-1 text-[10.5px] tracking-[0.2em] transition-colors duration-300 ${
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                {l.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-[1.5px] bg-[var(--foreground-accent)] transition-all duration-300 ease-out ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <span
          suppressHydrationWarning
          className="hidden shrink-0 text-[9px] tracking-[0.22em] text-[var(--foreground-secondary)] lg:inline"
        >
          {today}
        </span>
      </div>
    </header>
  );
}
