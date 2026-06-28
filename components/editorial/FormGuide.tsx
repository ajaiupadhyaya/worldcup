import type { Standing } from "@/lib/types";

function FormDots({ form, accentFirst = false }: { form: string; accentFirst?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {form.split("").slice(-5).map((result, i) => {
        const cls =
          result === "W"
            ? accentFirst && i === 0
              ? "form-dot form-dot--win-accent"
              : "form-dot form-dot--win"
            : result === "D"
              ? "form-dot form-dot--draw"
              : "form-dot form-dot--loss";
        return <span key={i} className={cls} aria-hidden />;
      })}
    </div>
  );
}

function winCount(form: string): number {
  return form.split("").filter((c) => c === "W").length;
}

export function FormGuide({ standings }: { standings: Standing[] }) {
  const withForm = standings
    .filter((s) => s.form && s.form.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank)
    .slice(0, 8);

  if (withForm.length === 0) return null;

  const mid = Math.ceil(withForm.length / 2);
  const columns = [withForm.slice(0, mid), withForm.slice(mid)];

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-10 sm:px-12">
      <div className="section-rule mb-8 pt-6">
        <h2 className="section-label">FORM GUIDE — LAST 5 MATCHES</h2>
      </div>
      <div className="grid gap-10 sm:grid-cols-2">
        {columns.map((col, ci) => (
          <div key={ci} className="space-y-6">
            {col.map((row) => (
              <div key={row.team.id} className="flex items-center gap-4">
                <span className="w-12 text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">
                  GRP {row.group.replace("Group ", "")}
                </span>
                <span className="min-w-0 flex-1 font-heading text-[22px] font-semibold text-[var(--foreground)]">
                  {row.team.name.toUpperCase()}
                </span>
                <FormDots form={row.form!} accentFirst={row.rank === 1} />
                <span className="w-8 text-[9px] tabular-nums text-[var(--foreground-secondary)]">
                  {winCount(row.form!)}W
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
