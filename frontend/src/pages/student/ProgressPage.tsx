import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { getProgress, type Progress, type ProgressPoint } from "../../api/student";
import type { SectionType } from "../../api/teacher";
import { BandChart } from "../../components/BandChart";
import { Card, ErrorBox, Spinner } from "../../components/ui";
import { QUESTION_TYPE_LABELS, SECTION_COLORS, SECTION_LABELS } from "../../lib/questionTypes";

const ORDER: SectionType[] = ["listening", "reading", "writing", "speaking"];
const dateFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

export function ProgressPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgress()
      .then(setProgress)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (!progress) return error ? <ErrorBox message={error} /> : <Spinner />;

  const series = ORDER.filter((t) => progress.sections[t]?.length).map(
    (t) => [t, progress.sections[t]!] as [SectionType, ProgressPoint[]]
  );
  const history = series
    .flatMap(([type, pts]) => pts.map((p) => ({ type, ...p })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const types = progress.question_types
    .map((t) => ({ ...t, accuracy: t.total ? (t.total - t.wrong) / t.total : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">My progress</h1>
      <p className="mt-1 text-ink-muted">Your band in each section over time and the question types to work on.</p>

      {series.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
          <TrendingUp className="h-8 w-8 text-brand-500" />
          <p className="mt-3 font-semibold text-ink">No results yet</p>
          <p className="mt-1 text-sm text-ink-muted">Finish a section and your band will appear here.</p>
          <Link to="/tests" className="mt-4 text-sm font-semibold text-brand-600">
            Go to tests →
          </Link>
        </Card>
      ) : (
        <>
          <Card className="mt-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Band score</h2>
              {series.length > 1 && (
                <ul className="flex flex-wrap gap-4 text-sm text-ink" aria-label="Legend">
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
                  {SECTION_LABELS[series[0][0]]} · latest <strong>{series[0][1][series[0][1].length - 1].band}</strong>
                </span>
              )}
            </div>
            <div className="mt-4">
              <BandChart series={series} />
            </div>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">Question types</h2>
              <p className="mt-1 text-sm text-ink-muted">Share of correct answers — weakest first.</p>
              <ul className="mt-4 space-y-4">
                {types.map((t) => (
                  <li key={t.type}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink">{QUESTION_TYPE_LABELS[t.type]}</span>
                      <span className="shrink-0 text-ink-muted">
                        {t.total - t.wrong}/{t.total} · <span className="font-semibold text-ink">{Math.round(t.accuracy * 100)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100" role="img" aria-label={`${Math.round(t.accuracy * 100)}% correct`}>
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${t.accuracy * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">History</h2>
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
                        Review
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
