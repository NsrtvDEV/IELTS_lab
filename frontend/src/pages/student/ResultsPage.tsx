import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { listAttempts, type Attempt } from "../../api/student";
import type { SectionType } from "../../api/teacher";
import { Badge, Card, ErrorBox, Spinner } from "../../components/ui";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { SECTION_ICONS, SECTION_TINTS } from "../../lib/sectionStyle";
import { SECTIONS, sectionResults } from "../../lib/studentStats";
import { locale, t } from "../../i18n";

const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

export function ResultsPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SectionType | "all">("all");

  useEffect(() => {
    listAttempts()
      .then(setAttempts)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (!attempts) return error ? <ErrorBox message={error} /> : <Spinner />;

  const all = sectionResults(attempts).reverse();
  const results = filter === "all" ? all : all.filter((r) => r.type === filter);
  // полные экзамены: сданные целиком (с overall band или ждут проверки) и начатые
  const mocks = attempts.filter((a) => a.section_type === null && a.status !== "abandoned" && a.sections.length > 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Results")}</h1>
          <p className="mt-1 text-ink-muted">{t("Every section you've submitted, newest first.")}</p>
        </div>
        <Link to="/progress" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {t("Progress charts")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {mocks.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mocks.map((a) => (
            <Link key={a.id} to={`/mock/${a.id}`}>
              <Card className="flex items-center gap-4 p-5 transition hover:border-brand-200">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Trophy className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{a.test_title}</div>
                  <div className="text-xs text-ink-muted">{t("Full mock")} · {dateFmt.format(new Date(a.finished_at ?? a.started_at))}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-ink-muted">{t("Overall")}</div>
                  {a.overall_band ? (
                    <div className="text-2xl font-extrabold text-brand-600">{a.overall_band}</div>
                  ) : (
                    <Badge color="amber">{a.status === "in_progress" ? t("In progress") : t("Checking")}</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:inline-flex" role="tablist">
        {(["all", ...SECTIONS] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={filter === s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-4 py-1.5 ${filter === s ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
          >
            {s === "all" ? t("All") : SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <Card className="mt-4 px-6 py-14 text-center text-ink-muted">
          {t("No results yet.")}{" "}
          <Link to="/tests" className="font-semibold text-brand-600">
            {t("Take a test")} →
          </Link>
        </Card>
      ) : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-ink-muted">
                <th className="px-5 py-3 font-medium">{t("Section")}</th>
                <th className="px-5 py-3 font-medium">{t("Test")}</th>
                <th className="px-5 py-3 font-medium">{t("Date")}</th>
                <th className="px-5 py-3 font-medium">{t("Correct")}</th>
                <th className="px-5 py-3 font-medium">{t("Band")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r) => {
                const Icon = SECTION_ICONS[r.type];
                return (
                  <tr key={r.sectionAttemptId}>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3 font-medium text-ink">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${SECTION_TINTS[r.type].icon}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {SECTION_LABELS[r.type]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink">
                      {r.testTitle}
                      {r.mode === "mock" && <span className="ml-1.5 text-xs text-ink-muted">({t("full mock")})</span>}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{dateFmt.format(new Date(r.date))}</td>
                    <td className="px-5 py-3 text-ink">{r.raw !== null ? `${r.raw}/40` : "—"}</td>
                    <td className="px-5 py-3">
                      {r.band !== null ? (
                        <span className="font-bold text-ink">{r.band.toFixed(1)}</span>
                      ) : (
                        <Badge color="amber">{t("Checking")}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/${r.type}/${r.sectionAttemptId}/result`} className="font-semibold text-brand-600 hover:text-brand-700">
                        {t("Review")} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
