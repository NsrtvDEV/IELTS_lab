import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, PlayCircle, Trophy, X } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  listAttempts,
  listPublishedTests,
  startFullMock,
  startSectionAttempt,
  type Attempt,
  type AvailableSection,
  type StudentTest,
} from "../../api/student";
import { UnfinishedBanner } from "../../components/UnfinishedBanner";
import { Badge, Button, Card, ErrorBox, Spinner } from "../../components/ui";
import { isMock, isUnfinished } from "../../lib/attempts";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { SECTION_ICONS } from "../../lib/sectionStyle";

/** Последний результат по каждому тесту и секции: ключ "<test_id>:<секция>" */
function lastResults(attempts: Attempt[]) {
  const result = new Map<string, { band: string | null; sectionAttemptId: number }>();
  for (const a of attempts) {
    if (a.status === "abandoned") continue;
    for (const sa of a.sections) {
      const key = `${a.test_id}:${sa.section_type}`;
      if (sa.submitted_at && !result.has(key)) result.set(key, { band: sa.band_score, sectionAttemptId: sa.id });
    }
  }
  return result;
}

export function MockTestsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const [tests, setTests] = useState<StudentTest[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPublishedTests(), listAttempts()])
      .then(([t, a]) => {
        setTests(t);
        setAttempts(a);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const unfinished = attempts.some(isUnfinished);
  const shown = tests?.filter((t) => t.title.toLowerCase().includes(query));
  const results = lastResults(attempts);

  async function startMock(testId: number) {
    setStarting(`${testId}:mock`);
    setError(null);
    try {
      const attempt = await startFullMock(testId);
      navigate(`/mock/${attempt.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setStarting(null);
    }
  }

  async function start(testId: number, section: AvailableSection) {
    setStarting(`${testId}:${section}`);
    setError(null);
    try {
      const content = await startSectionAttempt(testId, section);
      navigate(`/${section}/${content.section_attempt_id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setStarting(null);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mock Tests</h1>
      <p className="mt-1 text-ink-muted">
        Full IELTS Academic tests. Take the whole exam in order for an overall band, or any section on its own — Listening
        and Reading are checked instantly, Writing and Speaking by a teacher.
      </p>

      <div className="mt-6 space-y-4">
        <ErrorBox message={error} />
        <UnfinishedBanner attempts={attempts} />
        {query && (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            Search: <span className="font-semibold text-ink">“{params.get("q")}”</span> · {shown?.length ?? 0} found
            <button onClick={() => setParams({})} className="rounded p-1 hover:bg-slate-100" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        {!tests && !error && <Spinner />}
        {shown && shown.length === 0 && (
          <Card className="px-6 py-14 text-center text-ink-muted">
            {query ? "No tests match your search." : "No tests are published yet. Check back soon!"}
          </Card>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          {shown?.map((test) => {
            // последний полный экзамен по этому тесту (не прерванный)
            const lastMock = attempts.find((a) => isMock(a) && a.test_id === test.id && a.status !== "abandoned" && a.status !== "in_progress");
            return (
              <Card key={test.id} className="p-5">
                <h2 className="text-lg font-bold text-ink">{test.title}</h2>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50/60 p-4">
                  <PlayCircle className="h-6 w-6 text-brand-500" />
                  <div className="min-w-40 flex-1">
                    <div className="font-semibold text-ink">Full mock test</div>
                    <div className="text-xs text-ink-muted">All 4 sections in order · overall band</div>
                  </div>
                  {lastMock && (
                    <Link to={`/mock/${lastMock.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                      {lastMock.overall_band ? (
                        <Badge color="green">
                          <Trophy className="h-3 w-3" /> {lastMock.overall_band}
                        </Badge>
                      ) : (
                        <Badge color="amber">Checking</Badge>
                      )}{" "}
                      Result
                    </Link>
                  )}
                  <Button className="h-9" onClick={() => startMock(test.id)} loading={starting === `${test.id}:mock`} disabled={unfinished}>
                    Start full mock
                  </Button>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Or one section</p>
                <ul className="mt-1 divide-y divide-slate-100">
                  {test.sections.map((s) => {
                    const Icon = SECTION_ICONS[s.type];
                    const done = test.completed_sections.includes(s.type);
                    const last = results.get(`${test.id}:${s.type}`);
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
                        <div className="flex items-center gap-2">
                            {last && (
                              <Link
                                to={`/${s.type}/${last.sectionAttemptId}/result`}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                              >
                                {last.band ? <Badge color="green">{last.band}</Badge> : (s.type === "writing" || s.type === "speaking") && <Badge color="amber">Checking</Badge>} Result
                              </Link>
                            )}
                            <Button
                              className="h-9"
                              onClick={() => start(test.id, s.type)}
                              loading={starting === `${test.id}:${s.type}`}
                              disabled={unfinished}
                            >
                              {done ? "Retake" : "Start"}
                            </Button>
                          </div>
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
