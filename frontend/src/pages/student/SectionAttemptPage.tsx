import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, Clock, Loader2, LogOut, TriangleAlert } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  abandonAttempt,
  getReading,
  saveReadingAnswers,
  submitReading,
  type SavedAnswer,
  type SectionContent,
} from "../../api/student";
import { Logo } from "../../components/Logo";
import { ReadingWorkspace } from "../../components/reading/ReadingWorkspace";
import { isAnswered, type Answer } from "../../lib/answers";
import { Button, ErrorBox, Modal, Spinner } from "../../components/ui";

type SaveState = "saved" | "saving" | "error";

const SAVE_DELAY_MS = 800;

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ReadingPage() {
  const { sectionAttemptId } = useParams();
  const saId = Number(sectionAttemptId);
  const navigate = useNavigate();

  const [content, setContent] = useState<SectionContent | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"submit" | "exit" | null>(null);
  const [busy, setBusy] = useState<"submit" | "abandon" | "exit" | null>(null);

  const answersRef = useRef(answers);
  const dirty = useRef(new Set<number>());
  const saveTimer = useRef<number | undefined>(undefined);
  const submittedRef = useRef(false);

  const goToResult = useCallback(() => navigate(`/reading/${saId}/result`, { replace: true }), [navigate, saId]);

  useEffect(() => {
    getReading(saId)
      .then((c) => {
        setContent(c);
        const initial: Record<number, Answer> = {};
        for (const a of c.answers) initial[a.question_id] = { text: a.answer_text ?? "", options: a.option_ids };
        answersRef.current = initial;
        setAnswers(initial);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          // брошенная попытка — домой; сданная или истёкшая — к результату
          if (String(err.response.data?.detail).includes("not in progress")) navigate("/", { replace: true });
          else goToResult();
        } else setError(apiErrorMessage(err));
      });
  }, [saId, goToResult, navigate]);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    if (dirty.current.size === 0) return;
    const ids = [...dirty.current];
    dirty.current.clear();
    const payload: SavedAnswer[] = ids.map((id) => ({
      question_id: id,
      answer_text: answersRef.current[id]?.text.trim() || null,
      option_ids: answersRef.current[id]?.options ?? [],
    }));
    setSaveState("saving");
    try {
      await saveReadingAnswers(saId, payload);
      setSaveState(dirty.current.size ? "saving" : "saved");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        goToResult(); // время вышло — сервер сам сдал секцию
        return;
      }
      ids.forEach((id) => dirty.current.add(id));
      setSaveState("error");
      throw err;
    }
  }, [saId, goToResult]);

  function setAnswer(questionId: number, a: Answer) {
    const next = { ...answersRef.current, [questionId]: a };
    answersRef.current = next;
    setAnswers(next);
    dirty.current.add(questionId);
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => flush().catch(() => undefined), SAVE_DELAY_MS);
  }

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy("submit");
    try {
      await flush();
      await submitReading(saId);
      goToResult();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) return goToResult();
      submittedRef.current = false;
      setBusy(null);
      setError(apiErrorMessage(err));
    }
  }, [flush, saId, goToResult]);

  async function saveAndExit() {
    setBusy("exit");
    try {
      await flush();
      navigate("/");
    } catch (err) {
      setBusy(null);
      setError(apiErrorMessage(err));
    }
  }

  async function abandon() {
    if (!content) return;
    setBusy("abandon");
    try {
      window.clearTimeout(saveTimer.current);
      await abandonAttempt(content.attempt_id);
      navigate("/", { replace: true });
    } catch (err) {
      setBusy(null);
      setError(apiErrorMessage(err));
    }
  }

  // таймер; когда время вышло — сдаём автоматически (прямо из тика, без лишнего эффекта)
  const remaining = content ? new Date(content.deadline).getTime() - now : null;
  const deadlineRef = useRef<number | null>(null);
  const submitRef = useRef(submit);
  useEffect(() => {
    deadlineRef.current = content ? new Date(content.deadline).getTime() : null;
    submitRef.current = submit;
  }, [content, submit]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (deadlineRef.current !== null && t >= deadlineRef.current) submitRef.current();
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!content) {
    return <div className="p-8">{error ? <ErrorBox message={error} /> : <Spinner />}</div>;
  }

  const questionIds = content.question_groups.flatMap((g) => g.questions.map((q) => q.id));
  const answeredCount = questionIds.filter((id) => isAnswered(answers[id])).length;
  const lowTime = remaining !== null && remaining < 5 * 60 * 1000;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:gap-4 sm:px-6">
        <div className="hidden origin-left scale-[0.6] sm:block">
          <Logo />
        </div>
        <h1 className="font-bold text-ink sm:ml-[-60px]">Reading</h1>
        <div
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
            lowTime ? "bg-red-50 text-red-600" : "bg-slate-100 text-ink"
          }`}
          role="timer"
          aria-label="Time left"
        >
          <Clock className="h-4 w-4" /> {formatTime(remaining ?? 0)}
        </div>
        <span className="hidden w-24 text-xs text-ink-muted sm:inline-flex sm:items-center sm:gap-1" aria-live="polite">
          {saveState === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          )}
          {saveState === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Saved
            </>
          )}
          {saveState === "error" && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <TriangleAlert className="h-3.5 w-3.5" /> Not saved
            </span>
          )}
        </span>
        <Button variant="secondary" onClick={() => setDialog("exit")} aria-label="Exit test">
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Exit</span>
        </Button>
        <Button onClick={() => setDialog("submit")} loading={busy === "submit"}>
          Submit
        </Button>
      </header>

      {error && (
        <div className="px-4 pt-3 sm:px-6">
          <ErrorBox message={error} />
        </div>
      )}

      <ReadingWorkspace
        passages={content.passages}
        groups={content.question_groups}
        answers={answers}
        onAnswer={setAnswer}
        highlightKey={`bandup-highlights:${saId}`}
      />

      {dialog === "submit" && (
        <Modal title="Submit Reading?" onClose={() => setDialog(null)}>
          <p className="text-ink">
            You answered <strong>{answeredCount}</strong> of {questionIds.length} questions.
            {answeredCount < questionIds.length && " Unanswered questions will count as wrong."}
          </p>
          <p className="mt-2 text-sm text-ink-muted">After submitting you&apos;ll see your score and the correct answers.</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep working
            </Button>
            <Button onClick={submit} loading={busy === "submit"}>
              Submit
            </Button>
          </div>
        </Modal>
      )}

      {dialog === "exit" && (
        <Modal title="Leave the test?" onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <button
              onClick={saveAndExit}
              disabled={busy !== null}
              className="w-full rounded-xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
            >
              <div className="font-semibold text-ink">Save and continue later</div>
              <div className="mt-0.5 text-sm text-ink-muted">
                Your answers are saved. The timer keeps running — when it ends, the test is submitted automatically.
              </div>
            </button>
            <button
              onClick={abandon}
              disabled={busy !== null}
              className="w-full rounded-xl border border-red-200 p-4 text-left hover:bg-red-50 disabled:opacity-50"
            >
              <div className="font-semibold text-red-600">Abandon this test</div>
              <div className="mt-0.5 text-sm text-ink-muted">The attempt won&apos;t be scored and won&apos;t count in your progress.</div>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
