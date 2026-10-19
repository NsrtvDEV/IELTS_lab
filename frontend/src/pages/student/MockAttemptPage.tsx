import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Hourglass, Lock, Trophy } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  abandonAttempt,
  getAttempt,
  listPublishedTests,
  startSection,
  type Attempt,
  type AvailableSection,
} from "../../api/student";
import { Badge, Button, Card, ErrorBox, Modal, Spinner } from "../../components/ui";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { SECTION_ICONS, SECTION_TINTS } from "../../lib/sectionStyle";

// порядок секций на экзамене
const ORDER: AvailableSection[] = ["listening", "reading", "writing", "speaking"];
const ABOUT: Record<AvailableSection, string> = {
  listening: "4 recordings, each played once · 40 questions",
  reading: "3 passages · 40 questions",
  writing: "Task 1 and Task 2",
  speaking: "Part 1–3, answered into your microphone",
};

export function MockAttemptPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [durations, setDurations] = useState<Partial<Record<AvailableSection, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  useEffect(() => {
    getAttempt(Number(attemptId))
      .then(async (a) => {
        setAttempt(a);
        const test = (await listPublishedTests()).find((t) => t.id === a.test_id);
        if (test) setDurations(Object.fromEntries(test.sections.map((s) => [s.type, s.duration_min])));
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [attemptId]);

  if (!attempt) return error ? <ErrorBox message={error} /> : <Spinner />;

  const byType = new Map(attempt.sections.map((s) => [s.section_type, s]));
  const open = attempt.sections.find((s) => !s.submitted_at);
  const done = attempt.sections.filter((s) => s.submitted_at).length;
  const inProgress = attempt.status === "in_progress";

  async function startNext() {
    if (!attempt?.next_section) return;
    setStarting(true);
    setError(null);
    try {
      const { section_attempt_id } = await startSection(attempt.id, attempt.next_section as AvailableSection);
      navigate(`/${attempt.next_section}/${section_attempt_id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setStarting(false);
    }
  }

  async function abandon() {
    try {
      await abandonAttempt(attempt!.id);
      setAttempt(await getAttempt(attempt!.id));
      setConfirmAbandon(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/tests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Mock Tests
      </Link>

      <Card className="mt-4 flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
        <div>
          <p className="font-semibold text-brand-600">Full mock test · {attempt.test_title}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
            {attempt.status === "finished"
              ? "Your full mock result"
              : attempt.status === "pending_review"
                ? "Waiting for assessment"
                : attempt.status === "abandoned"
                  ? "This mock test was abandoned"
                  : done === 0
                    ? "Ready to start?"
                    : `${done} of 4 sections done`}
          </h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            {attempt.status === "finished"
              ? "The overall band is the average of your four section bands."
              : attempt.status === "pending_review"
                ? "Listening and Reading are checked. A teacher will assess your Writing and Speaking — then you'll get your overall band."
                : attempt.status === "abandoned"
                  ? "It doesn't count in your progress."
                  : "The sections go in order, like the real exam. Each section has its own timer. You can take a break between sections."}
          </p>
        </div>
        {attempt.overall_band ? (
          <div className="flex flex-col items-center rounded-2xl bg-brand-50 px-8 py-5">
            <Trophy className="h-6 w-6 text-brand-500" />
            <span className="mt-1 text-sm font-medium text-brand-700">Overall band</span>
            <span className="text-5xl font-extrabold text-brand-600">{attempt.overall_band}</span>
          </div>
        ) : (
          attempt.status === "pending_review" && <Hourglass className="h-10 w-10 text-amber-500" />
        )}
      </Card>

      <ErrorBox message={error} />

      <ol className="mt-6 space-y-3">
        {ORDER.map((type, i) => {
          const sa = byType.get(type);
          const Icon = SECTION_ICONS[type];
          const isNext = inProgress && !open && attempt.next_section === type;
          const isOpen = open?.section_type === type;
          const locked = !sa && !isNext;
          return (
            <li key={type}>
              <Card className={`flex flex-wrap items-center gap-4 p-5 ${isNext || isOpen ? "ring-2 ring-brand-300" : ""}`}>
                <span className="w-6 text-center text-sm font-bold text-ink-muted">{i + 1}</span>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${locked ? "bg-slate-100 text-slate-400" : SECTION_TINTS[type].icon}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-48 flex-1">
                  <div className={`font-semibold ${locked ? "text-ink-muted" : "text-ink"}`}>{SECTION_LABELS[type]}</div>
                  <div className="flex items-center gap-1 text-xs text-ink-muted">
                    {durations[type] && (
                      <>
                        <Clock className="h-3.5 w-3.5" /> {durations[type]} min ·{" "}
                      </>
                    )}
                    {ABOUT[type]}
                  </div>
                </div>
                {sa?.submitted_at ? (
                  <div className="flex items-center gap-3">
                    {sa.band_score ? <Badge color="green">Band {sa.band_score}</Badge> : <Badge color="amber">Checking</Badge>}
                    <Link to={`/${type}/${sa.id}/result`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Result →
                    </Link>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Done" />
                  </div>
                ) : isOpen && inProgress ? (
                  <Link to={`/${type}/${open!.id}`}>
                    <Button>Continue</Button>
                  </Link>
                ) : isNext ? (
                  <Button onClick={startNext} loading={starting}>
                    Start {SECTION_LABELS[type]}
                  </Button>
                ) : (
                  <Lock className="h-4 w-4 text-slate-300" aria-label="Locked" />
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      {inProgress && (
        <div className="mt-6 text-right">
          <button onClick={() => setConfirmAbandon(true)} className="text-sm font-medium text-red-600 hover:text-red-700">
            Abandon this mock test
          </button>
        </div>
      )}

      {confirmAbandon && (
        <Modal title="Abandon the mock test?" onClose={() => setConfirmAbandon(false)}>
          <p className="text-sm text-ink-muted">
            Sections you haven&apos;t finished won&apos;t be taken, and this mock won&apos;t count in your progress.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmAbandon(false)}>
              Keep going
            </Button>
            <Button variant="danger" onClick={abandon}>
              Abandon
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
