import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, Clock, Loader2, LogOut, TriangleAlert } from "lucide-react";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import {
  abandonAttempt,
  getWriting,
  saveWriting,
  submitWriting,
  type WritingContent,
} from "../../api/student";
import { Logo } from "../../components/Logo";
import { PaneSwitch } from "../../components/PaneSwitch";
import { Button, ErrorBox, Modal, Spinner } from "../../components/ui";
import { afterSubmitPath } from "../../lib/attempts";
import { countWords } from "../../lib/writing";
import { t, tn } from "../../i18n";

type SaveState = "saved" | "saving" | "error";
const SAVE_DELAY_MS = 1000;

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function WritingPage() {
  const { sectionAttemptId } = useParams();
  const saId = Number(sectionAttemptId);
  const navigate = useNavigate();

  const [content, setContent] = useState<WritingContent | null>(null);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [active, setActive] = useState(0);
  const [pane, setPane] = useState<"task" | "answer">("task"); // на телефоне — по очереди
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"submit" | "exit" | null>(null);
  const [busy, setBusy] = useState<"submit" | "abandon" | "exit" | null>(null);

  const textsRef = useRef(texts);
  const dirty = useRef(new Set<number>());
  const saveTimer = useRef<number | undefined>(undefined);
  const submittedRef = useRef(false);

  const goToResult = useCallback(
    () => afterSubmitPath("writing", saId).then((path) => navigate(path, { replace: true })),
    [navigate, saId]
  );

  useEffect(() => {
    getWriting(saId)
      .then((c) => {
        setContent(c);
        const initial: Record<number, string> = {};
        for (const r of c.responses) initial[r.task_id] = r.text;
        textsRef.current = initial;
        setTexts(initial);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
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
    setSaveState("saving");
    try {
      await Promise.all(ids.map((id) => saveWriting(saId, id, textsRef.current[id] ?? "")));
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

  function setText(taskId: number, text: string) {
    const next = { ...textsRef.current, [taskId]: text };
    textsRef.current = next;
    setTexts(next);
    dirty.current.add(taskId);
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
      await submitWriting(saId);
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

  // таймер; когда время вышло — сдаём автоматически
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

  if (!content) return <div className="p-8">{error ? <ErrorBox message={error} /> : <Spinner />}</div>;

  const task = content.tasks[active];
  const words = (id: number) => countWords(texts[id] ?? "");
  const lowTime = remaining !== null && remaining < 5 * 60 * 1000;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:gap-4 sm:px-6">
        <div className="hidden origin-left scale-[0.6] sm:block">
          <Logo />
        </div>
        <h1 className="font-bold text-ink sm:ml-[-60px]">Writing</h1>
        <div
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
            lowTime ? "bg-red-50 text-red-600" : "bg-slate-100 text-ink"
          }`}
          role="timer"
          aria-label={t("Time left")}
        >
          <Clock className="h-4 w-4" /> {formatTime(remaining ?? 0)}
        </div>
        <span className="hidden w-24 text-xs text-ink-muted sm:inline-flex sm:items-center sm:gap-1" aria-live="polite">
          {saveState === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Saving…")}
            </>
          )}
          {saveState === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {t("Saved")}
            </>
          )}
          {saveState === "error" && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <TriangleAlert className="h-3.5 w-3.5" /> {t("Not saved")}
            </span>
          )}
        </span>
        <Button variant="secondary" onClick={() => setDialog("exit")} aria-label={t("Exit test")}>
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t("Exit")}</span>
        </Button>
        <Button onClick={() => setDialog("submit")} loading={busy === "submit"}>
          {t("Submit")}
        </Button>
      </header>

      {error && (
        <div className="px-4 pt-3 sm:px-6">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="flex shrink-0 gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:px-6" role="tablist" aria-label={t("Tasks")}>
        {content.tasks.map((tk, i) => {
          const enough = words(tk.id) >= tk.min_words;
          return (
            <button
              key={tk.id}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                i === active ? "bg-brand-500 text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
              }`}
            >
              {t("Task {n}", { n: tk.task_number })}
              <span className={`rounded px-1.5 text-xs ${i === active ? "bg-white/20" : enough ? "bg-emerald-100 text-emerald-700" : "bg-white"}`}>
                {words(tk.id)}
              </span>
            </button>
          );
        })}
        <PaneSwitch
          className="ml-auto"
          value={pane}
          onChange={setPane}
          label={t("Show")}
          options={[
            { value: "task", label: t("Task") },
            { value: "answer", label: t("Answer") },
          ]}
        />
      </div>

      {task && (
        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <section
            className={`${pane === "task" ? "" : "hidden"} min-h-0 overflow-y-auto bg-white px-5 py-5 sm:px-8 lg:block lg:border-r lg:border-slate-200`}
          >
            <p className="text-sm font-semibold text-ink-muted">
              You should spend about {task.recommended_min} minutes on this task.
            </p>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-ink">{task.prompt}</p>
            {task.image_url && (
              <img
                src={resolveMediaUrl(task.image_url)}
                alt={t("Task {n} visual", { n: task.task_number })}
                className="mt-4 max-h-[28rem] w-auto max-w-full rounded-lg border border-slate-200"
              />
            )}
            <p className="mt-4 text-sm font-semibold text-ink">Write at least {task.min_words} words.</p>
          </section>

          <section className={`${pane === "answer" ? "flex" : "hidden"} min-h-0 flex-col bg-[#f7f9fd] px-5 py-5 sm:px-8 lg:flex`}>
            <textarea
              key={task.id}
              value={texts[task.id] ?? ""}
              onChange={(e) => setText(task.id, e.target.value)}
              className="min-h-64 w-full flex-1 resize-none rounded-xl border border-slate-200 bg-white p-4 text-[15px] leading-7 text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
              placeholder={t("Write your answer to Task {n} here…", { n: task.task_number })}
              aria-label={t("Answer to Task {n}", { n: task.task_number })}
              spellCheck={false} // на компьютерном IELTS проверки орфографии нет
              autoCorrect="off"
              autoCapitalize="off"
            />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className={words(task.id) >= task.min_words ? "font-semibold text-emerald-600" : "text-ink-muted"}>
                {tn(words(task.id), "{n} word", "{n} words")}
              </span>
              {words(task.id) < task.min_words && (
                <span className="text-ink-muted">{t("{n} more to reach {min}", { n: task.min_words - words(task.id), min: task.min_words })}</span>
              )}
            </div>
          </section>
        </div>
      )}

      {dialog === "submit" && (
        <Modal title={t("Submit {section}?", { section: "Writing" })} onClose={() => setDialog(null)}>
          <ul className="space-y-2">
            {content.tasks.map((tk) => {
              const n = words(tk.id);
              return (
                <li key={tk.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-ink">{t("Task {n}", { n: tk.task_number })}</span>
                  <span className={n >= tk.min_words ? "text-emerald-600" : "font-semibold text-amber-700"}>
                    {n} / {tn(tk.min_words, "{n} word", "{n} words")}
                  </span>
                </li>
              );
            })}
          </ul>
          {content.tasks.some((tk) => words(tk.id) < tk.min_words) && (
            <p className="mt-3 text-sm text-amber-700">
              {t("An answer under the minimum length loses marks for task achievement.")}
            </p>
          )}
          <p className="mt-3 text-sm text-ink-muted">{t("After submitting, a teacher will assess your essays.")}</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t("Keep writing")}
            </Button>
            <Button onClick={submit} loading={busy === "submit"}>
              {t("Submit")}
            </Button>
          </div>
        </Modal>
      )}

      {dialog === "exit" && (
        <Modal title={t("Leave the test?")} onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <button
              onClick={saveAndExit}
              disabled={busy !== null}
              className="w-full rounded-xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
            >
              <div className="font-semibold text-ink">{t("Save and continue later")}</div>
              <div className="mt-0.5 text-sm text-ink-muted">
                {t("Your text is saved. The timer keeps running — when it ends, the work is submitted automatically.")}
              </div>
            </button>
            <button
              onClick={abandon}
              disabled={busy !== null}
              className="w-full rounded-xl border border-red-200 p-4 text-left hover:bg-red-50 disabled:opacity-50"
            >
              <div className="font-semibold text-red-600">{t("Abandon this test")}</div>
              <div className="mt-0.5 text-sm text-ink-muted">{t("The work won't be assessed and won't count in your progress.")}</div>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
