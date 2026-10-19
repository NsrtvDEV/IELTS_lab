import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, CheckCircle2, Clock } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  listAttempts,
  listPublishedTests,
  startSectionAttempt,
  type Attempt,
  type AvailableSection,
  type StudentTest,
} from "../../api/student";
import { UnfinishedBanner } from "../../components/UnfinishedBanner";
import { Badge, Button, Card, ErrorBox, Spinner } from "../../components/ui";
import { isUnfinished } from "../../lib/attempts";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { SECTION_ICONS, SECTION_TINTS } from "../../lib/sectionStyle";
import { SECTIONS, sectionResults, sectionSummaries, signed } from "../../lib/studentStats";
import { locale, t } from "../../i18n";

const ABOUT: Record<AvailableSection, string> = {
  reading: t("3 passages · 40 questions. Answers are checked as soon as you finish."),
  listening: t("4 recordings, each played once · 40 questions. Answers are checked as soon as you finish."),
  writing: t("Task 1 (150+ words) and Task 2 (250+ words). A teacher assesses your essays."),
  speaking: t("Part 1–3 answered into your microphone. A teacher assesses your recordings."),
};

const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

export function PracticePage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const [tests, setTests] = useState<StudentTest[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([listPublishedTests(), listAttempts()])
      .then(([t, a]) => {
        setTests(t);
        setAttempts(a);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (!SECTIONS.includes(section as AvailableSection)) return <Navigate to="/" replace />;
  const type = section as AvailableSection;
  if (!tests) return error ? <ErrorBox message={error} /> : <Spinner />;

  const results = sectionResults(attempts).filter((r) => r.type === type);
  const summary = sectionSummaries(results)[type];
  const unfinished = attempts.some(isUnfinished);
  const Icon = SECTION_ICONS[type];
  const tint = SECTION_TINTS[type];

  async function start(testId: number) {
    setStarting(testId);
    setError(null);
    try {
      const content = await startSectionAttempt(testId, type);
      navigate(`/${type}/${content.section_attempt_id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setStarting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center gap-5 rounded-3xl border p-6 sm:p-8 ${tint.card}`}>
        <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tint.icon}`}>
          <Icon className="h-8 w-8" />
        </span>
        <div className="min-w-60 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{SECTION_LABELS[type]}</h1>
          <p className="mt-1 text-ink-muted">{ABOUT[type]}</p>
        </div>
        <div className="rounded-2xl bg-white px-6 py-4 text-center shadow-sm">
          <div className="text-xs font-medium text-ink-muted">{t("Latest band")}</div>
          <div className="text-3xl font-extrabold text-ink">{summary.band?.toFixed(1) ?? "—"}</div>
          {summary.change !== null && summary.change !== 0 && (
            <div className={`inline-flex items-center gap-0.5 text-xs font-semibold ${summary.change > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {summary.change > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              {signed(summary.change)}
            </div>
          )}
        </div>
      </div>

      <UnfinishedBanner attempts={attempts} />
      <ErrorBox message={error} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5">
          <h2 className="text-lg font-bold text-ink">{t("Tests")}</h2>
          {tests.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">{t("No tests are published yet. Check back soon!")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {tests.map((test) => {
                const s = test.sections.find((x) => x.type === type);
                if (!s) return null;
                const done = test.completed_sections.includes(type);
                const last = [...results].reverse().find((r) => r.testId === test.id);
                return (
                  <li key={test.id} className="flex flex-wrap items-center gap-3 py-4">
                    <div className="min-w-48 flex-1">
                      <div className="flex items-center gap-2 font-semibold text-ink">
                        {test.title}
                        {done && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label={t("Completed")} />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <Clock className="h-3.5 w-3.5" /> {t("{n} min", { n: s.duration_min })}
                      </div>
                    </div>
                    {last && (
                      <Link
                        to={`/${type}/${last.sectionAttemptId}/result`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        {last.band !== null ? <Badge color="green">{last.band.toFixed(1)}</Badge> : <Badge color="amber">{t("Checking")}</Badge>} {t("Result")}
                      </Link>
                    )}
                    <Button className="h-9" onClick={() => start(test.id)} loading={starting === test.id} disabled={unfinished}>
                      {done ? t("Retake") : t("Start")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-bold text-ink">{t("Your {section} history", { section: SECTION_LABELS[type] })}</h2>
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">{t("You haven't taken {section} yet.", { section: SECTION_LABELS[type] })}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {[...results].reverse().map((r) => (
                <li key={r.sectionAttemptId}>
                  <Link to={`/${type}/${r.sectionAttemptId}/result`} className="flex items-center gap-3 py-3 text-sm hover:text-brand-700">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">
                        {r.testTitle}
                        {r.mode === "mock" && <span className="ml-1.5 text-xs text-ink-muted">({t("full mock")})</span>}
                      </div>
                      <div className="text-xs text-ink-muted">{dateFmt.format(new Date(r.date))}</div>
                    </div>
                    {r.band !== null ? <span className="font-bold text-ink">{r.band.toFixed(1)}</span> : <Badge color="amber">{t("Checking")}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
