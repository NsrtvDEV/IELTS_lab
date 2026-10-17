import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock, Headphones, Mic, PenLine, PlayCircle, type LucideIcon } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  listAttempts,
  listPublishedTests,
  startReadingAttempt,
  type Attempt,
  type StudentTest,
} from "../../api/student";
import type { SectionType } from "../../api/teacher";
import { Badge, Button, Card, ErrorBox, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { greeting } from "../../lib/format";
import { SECTION_LABELS } from "../../lib/questionTypes";

const ICONS: Record<SectionType, LucideIcon> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};
// какие секции уже можно проходить на сайте
const AVAILABLE: SectionType[] = ["reading"];

/** Последний результат Reading по каждому тесту */
function lastReadingResults(attempts: Attempt[]) {
  const result = new Map<number, { band: string | null; sectionAttemptId: number }>();
  for (const a of attempts) {
    const sa = a.sections.find((s) => s.section_type === "reading" && s.submitted_at);
    if (sa && !result.has(a.test_id)) result.set(a.test_id, { band: sa.band_score, sectionAttemptId: sa.id });
  }
  return result;
}

export function StudentHomePage() {
  const { user } = useAuth();
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

  // начатый и не сданный Reading — можно продолжить
  const unfinished = attempts
    .filter((a) => a.status === "in_progress")
    .flatMap((a) => a.sections.filter((s) => s.section_type === "reading" && !s.submitted_at).map((s) => ({ a, s })))[0];
  const results = lastReadingResults(attempts);

  async function start(testId: number) {
    setStarting(testId);
    setError(null);
    try {
      const content = await startReadingAttempt(testId);
      navigate(`/reading/${content.section_attempt_id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setStarting(null);
    }
  }

  return (
    <>
      <p className="font-semibold text-brand-600">
        {greeting()}, {user?.profile?.first_name || "there"} 👋
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">Practice IELTS Academic</h1>
      <p className="mt-1 text-ink-muted">Pick a mock test and a section. Your answers are checked as soon as you finish.</p>

      <div className="mt-6 space-y-4">
        <ErrorBox message={error} />
        {unfinished && (
          <Card className="flex flex-wrap items-center gap-4 border-brand-200 bg-brand-50/50 p-5">
            <PlayCircle className="h-8 w-8 text-brand-500" />
            <div className="min-w-48 flex-1">
              <div className="font-semibold text-ink">You have an unfinished Reading test</div>
              <div className="text-sm text-ink-muted">{unfinished.a.test_title} — the timer keeps running.</div>
            </div>
            <Link to={`/reading/${unfinished.s.id}`}>
              <Button>Continue</Button>
            </Link>
          </Card>
        )}
      </div>

      <div className="mt-6">
        {!tests && !error && <Spinner />}
        {tests && tests.length === 0 && (
          <Card className="px-6 py-14 text-center text-ink-muted">No tests are published yet. Check back soon!</Card>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          {tests?.map((test) => {
            const last = results.get(test.id);
            return (
              <Card key={test.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-ink">{test.title}</h2>
                  {last && <Badge color="green">Reading {last.band ?? "done"}</Badge>}
                </div>
                <ul className="mt-4 divide-y divide-slate-100">
                  {test.sections.map((s) => {
                    const Icon = ICONS[s.type];
                    const available = AVAILABLE.includes(s.type);
                    const done = test.completed_sections.includes(s.type);
                    return (
                      <li key={s.type} className="flex items-center gap-3 py-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                          <Icon className="h-[18px] w-[18px] text-brand-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-semibold text-ink">
                            {SECTION_LABELS[s.type]}
                            {done && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Completed" />}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-ink-muted">
                            <Clock className="h-3.5 w-3.5" /> {s.duration_min} min
                          </div>
                        </div>
                        {available ? (
                          <div className="flex items-center gap-2">
                            {last && s.type === "reading" && (
                              <Link to={`/reading/${last.sectionAttemptId}/result`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                                Result
                              </Link>
                            )}
                            <Button className="h-9" onClick={() => start(test.id)} loading={starting === test.id} disabled={!!unfinished}>
                              {done ? "Retake" : "Start"}
                            </Button>
                          </div>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Soon</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
