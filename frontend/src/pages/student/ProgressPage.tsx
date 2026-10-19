import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { getProgress, type Progress, type ProgressPoint } from "../../api/student";
import type { SectionType } from "../../api/teacher";
import { BandChart } from "../../components/BandChart";
import { Card, ErrorBox, Spinner } from "../../components/ui";
import { QUESTION_TYPE_LABELS, SECTION_COLORS, SECTION_LABELS } from "../../lib/questionTypes";
import { locale, t } from "../../i18n";

const ORDER: SectionType[] = ["listening", "reading", "writing", "speaking"];
const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

export function ProgressPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgress()
      .then(setProgress)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (!progress) return error ? <ErrorBox message={error} /> : <Spinner />;

  const series = ORDER.filter((type) => progress.sections[type]?.length).map(
    (type) => [type, progress.sections[type]!] as [SectionType, ProgressPoint[]]
  );
  const history = series
    .flatMap(([type, pts]) => pts.map((p) => ({ type, ...p })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const types = progress.question_types
    .map((qt) => ({ ...qt, accuracy: qt.total ? (qt.total - qt.wrong) / qt.total : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("My progress")}</h1>
      <p className="mt-1 text-ink-muted">{t("Your band in each section over time and the question types to work on.")}</p>

      {series.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
          <TrendingUp className="h-8 w-8 text-brand-500" />
          <p className="mt-3 font-semibold text-ink">{t("No results yet")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("Finish a section and your band will appear here.")}</p>
          <Link to="/tests" className="mt-4 text-sm font-semibold text-brand-600">
            {t("Go to tests")} →
          </Link>
        </Card>
      ) : (
        <>
          <Card className="mt-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">{t("Band score")}</h2>
              {series.length > 1 && (
                <ul className="flex flex-wrap gap-4 text-sm text-ink" aria-label={t("Legend")}>
                  {series.map(([type, pts]) => (
                    <li key={type} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SECTION_COLORS[type] }} aria-hidden />
                      {SECTION_LABELS[type]} <span className="font-semibold">{pts[pts.length - 1].band}</span>
                    </li>
                  ))}
                </ul>
              )}
              {series.length === 1 && (
                <span className="text-sm text-ink">
                  {SECTION_LABELS[series[0][0]]} · {t("latest")} <strong>{series[0][1][series[0][1].length - 1].band}</strong>
                </span>
              )}
            </div>
            <div className="mt-4">
              <BandChart series={series} />
            </div>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">{t("Question types")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t("Share of correct answers — weakest first.")}</p>
              <ul className="mt-4 space-y-4">
                {types.map((qt) => (
                  <li key={qt.type}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink">{QUESTION_TYPE_LABELS[qt.type]}</span>
                      <span className="shrink-0 text-ink-muted">
                        {qt.total - qt.wrong}/{qt.total} · <span className="font-semibold text-ink">{Math.round(qt.accuracy * 100)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100" role="img" aria-label={t("{p}% correct", { p: Math.round(qt.accuracy * 100) })}>
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${qt.accuracy * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">{t("History")}</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {history.map((h) => (
                  <li key={`${h.type}-${h.section_attempt_id}`} className="flex items-center gap-3 py-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTION_COLORS[h.type] }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">
                        {SECTION_LABELS[h.type]} · {h.test_title}
                      </div>
                      <div className="text-xs text-ink-muted">{dateFmt.format(new Date(h.date))}</div>
                    </div>
                    <span className="font-bold text-ink">{h.band}</span>
                    {h.section_attempt_id && (
                      <Link to={`/${h.type}/${h.section_attempt_id}/result`} className="font-semibold text-brand-600 hover:text-brand-700">
                        {t("Review")}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
