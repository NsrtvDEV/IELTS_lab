import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Clock, Loader2, LogOut, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  abandonAttempt,
  getSpeaking,
  submitSpeaking,
  uploadSpeakingAnswer,
  type SpeakingContent,
  type SpeakingTask,
} from "../../api/student";
import { Logo } from "../../components/Logo";
import { Button, Card, ErrorBox, Modal, Spinner } from "../../components/ui";
import { afterSubmitPath } from "../../lib/attempts";
import { PARTS, formatSeconds } from "../../lib/speaking";
import { t, tn } from "../../i18n";

type Phase = "question" | "prep" | "recording" | "uploading" | "upload-error" | "finishing";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MIN_ANSWER_MS = 2000; // раньше закончить ответ нельзя — от случайного клика

function recordingSupported() {
  return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pickMimeType() {
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** Экзаменатор читает вопрос вслух (голос браузера); без синтеза речи — короткая пауза */
function speak(text: string, enabled: boolean): Promise<void> {
  if (!enabled || !("speechSynthesis" in window)) return new Promise((r) => window.setTimeout(r, 1500));
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.95;
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    // в некоторых браузерах onend не приходит — не ждём дольше, чем нужно на чтение
    const limit = window.setTimeout(done, Math.min(20000, 2000 + text.split(/\s+/).length * 500));
    function done() {
      window.clearTimeout(limit);
      resolve();
    }
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
  });
}

/** Громкость микрофона 0–1 — чтобы ученик видел, что его слышно */
function useMicLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const id = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 5));
    }, 100);
    return () => {
      window.clearInterval(id);
      ctx.close().catch(() => undefined);
    };
  }, [stream]);
  return stream ? level : 0;
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="flex h-6 items-end gap-1" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-full transition-all ${level * 12 > i ? "bg-emerald-500" : "bg-slate-200"}`}
          style={{ height: `${30 + i * 6}%` }}
        />
      ))}
    </div>
  );
}

export function SpeakingPage() {
  const { sectionAttemptId } = useParams();
  const saId = Number(sectionAttemptId);
  const navigate = useNavigate();

  const [content, setContent] = useState<SpeakingContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [phaseEnds, setPhaseEnds] = useState<number | null>(null);
  const [phaseStarted, setPhaseStarted] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [voice, setVoice] = useState(true);
  const [notes, setNotes] = useState("");
  const [dialog, setDialog] = useState<"exit" | null>(null);
  const [busy, setBusy] = useState<"abandon" | "exit" | null>(null);
  const level = useMicLevel(stream);

  // всё, что читают таймер и колбэки записи, — в ref: они живут дольше одного рендера
  const state = useRef({ phase: "question" as Phase, phaseEnds: null as number | null, index: 0, voice: true });
  const recorder = useRef<MediaRecorder | null>(null);
  const pending = useRef<{ task: SpeakingTask; blob: Blob; duration: number } | null>(null);
  const discard = useRef(false);
  const timeUp = useRef(false);
  const finishing = useRef(false);
  const run = useRef(0); // номер шага: устаревшие асинхронные шаги ничего не делают

  const goToResult = useCallback(
    () => afterSubmitPath("speaking", saId).then((path) => navigate(path, { replace: true })),
    [navigate, saId]
  );

  useEffect(() => {
    getSpeaking(saId)
      .then((c) => {
        setContent(c);
        const next = c.tasks.findIndex((t) => !c.answered_task_ids.includes(t.id));
        setIndex(next === -1 ? c.tasks.length : next);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          if (String(err.response.data?.detail).includes("not in progress")) navigate("/", { replace: true });
          else goToResult();
        } else setError(apiErrorMessage(err));
      });
  }, [saId, goToResult, navigate]);

  // микрофон выключаем, когда уходим со страницы
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  useEffect(() => {
    // в режиме разработки React монтирует страницу дважды: после «размонтирования» флаг надо вернуть,
    // иначе запись по «Finish answer» выбрасывается и следующий вопрос не наступает
    discard.current = false;
    return () => {
      // refs здесь не DOM-узлы: при уходе нужны именно текущие значения
      // eslint-disable-next-line react-hooks/exhaustive-deps
      run.current++;
      discard.current = true;
      recorder.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function setStep(next: Phase, endsAt: number | null = null) {
    state.current.phase = next;
    state.current.phaseEnds = endsAt;
    setPhase(next);
    setPhaseEnds(endsAt);
    setPhaseStarted(Date.now());
  }

  async function enableMic() {
    setMicError(null);
    if (!recordingSupported()) {
      setMicError(t("This browser can't record audio. Use the latest Chrome, Edge, Firefox or Safari."));
      return;
    }
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }));
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setMicError(
        name === "NotAllowedError"
          ? t("Microphone access is blocked. Allow it in the browser's address bar and try again.")
          : name === "NotFoundError"
            ? t("No microphone found. Connect one and try again.")
            : t("Couldn't turn on the microphone. Check that no other app is using it.")
      );
    }
  }

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    run.current++;
    setStep("finishing");
    try {
      await submitSpeaking(saId);
    } catch (err) {
      if (!(axios.isAxiosError(err) && err.response?.status === 409)) {
        finishing.current = false;
        setError(apiErrorMessage(err));
        return;
      }
    }
    goToResult();
  }

  async function runTask(i: number) {
    const id = ++run.current;
    if (!content || i >= content.tasks.length || timeUp.current) return finish();
    const task = content.tasks[i];
    state.current.index = i;
    setIndex(i);
    setNotes("");
    setError(null);
    if (task.prep_time_sec > 0) {
      setStep("prep", Date.now() + task.prep_time_sec * 1000); // дальше — таймер
      return;
    }
    setStep("question");
    await speak(task.prompt, state.current.voice);
    if (id === run.current) startRecording(task);
  }

  function startRecording(task: SpeakingTask) {
    if (!stream) return;
    run.current++;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const begin = Date.now();
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      recorder.current = null;
      if (discard.current) return;
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
      pending.current = { task, blob, duration: (Date.now() - begin) / 1000 };
      upload();
    };
    rec.start(1000);
    recorder.current = rec;
    setStep("recording", begin + task.speak_time_sec * 1000);
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") {
      state.current.phaseEnds = null;
      recorder.current.stop(); // дальше — onstop → upload
    }
  }

  async function upload() {
    const item = pending.current;
    if (!item) return;
    setStep("uploading");
    try {
      await uploadSpeakingAnswer(saId, item.task.id, item.blob, item.duration);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const detail = axios.isAxiosError(err) ? String(err.response?.data?.detail ?? "") : "";
      if (status === 409 && !detail.includes("already answered")) {
        // время вышло или попытка закрыта — сервер уже всё сдал
        return detail.includes("not in progress") ? navigate("/", { replace: true }) : goToResult();
      }
      if (status !== 409) {
        setError(apiErrorMessage(err));
        setStep("upload-error");
        return;
      }
    }
    pending.current = null;
    runTask(state.current.index + 1);
  }

  // таймер: подготовка Part 2, длина ответа и время всей секции
  const tick = useRef<() => void>(() => undefined);
  useEffect(() => {
    tick.current = () => {
      const t = Date.now();
      setNow(t);
      if (!content || !started || finishing.current) return;
      const s = state.current;
      if (!timeUp.current && t >= new Date(content.deadline).getTime()) {
        timeUp.current = true;
        if (s.phase === "recording") stopRecording(); // ответ сохранится, затем сдача
        else if (s.phase !== "uploading") finish();
        return;
      }
      if (s.phaseEnds !== null && t >= s.phaseEnds) {
        if (s.phase === "prep") startRecording(content.tasks[s.index]);
        else if (s.phase === "recording") stopRecording();
      }
    };
  });
  useEffect(() => {
    const id = window.setInterval(() => tick.current(), 250);
    return () => window.clearInterval(id);
  }, []);

  function start() {
    setStarted(true);
    runTask(index);
  }

  function toggleVoice() {
    state.current.voice = !voice;
    setVoice(!voice);
    if (voice && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function leave() {
    run.current++;
    discard.current = true;
    recorder.current?.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function saveAndExit() {
    setBusy("exit");
    leave();
    navigate("/");
  }

  async function abandon() {
    if (!content) return;
    setBusy("abandon");
    try {
      leave();
      await abandonAttempt(content.attempt_id);
      navigate("/", { replace: true });
    } catch (err) {
      setBusy(null);
      setError(apiErrorMessage(err));
    }
  }

  if (!content) return <div className="p-8">{error ? <ErrorBox message={error} /> : <Spinner />}</div>;

  const remaining = new Date(content.deadline).getTime() - now;
  const task = content.tasks[index] as SpeakingTask | undefined;
  const phaseLeft = phaseEnds !== null ? (phaseEnds - now) / 1000 : 0;
  const counts = ([1, 2, 3] as const).map((p) => content.tasks.filter((t) => t.part === p).length);

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fd]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:gap-4 sm:px-6">
        <div className="hidden origin-left scale-[0.6] sm:block">
          <Logo />
        </div>
        <h1 className="font-bold text-ink sm:ml-[-60px]">Speaking</h1>
        <div
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
            remaining < 2 * 60 * 1000 ? "bg-red-50 text-red-600" : "bg-slate-100 text-ink"
          }`}
          role="timer"
          aria-label={t("Time left")}
        >
          <Clock className="h-4 w-4" /> {formatSeconds(remaining / 1000)}
        </div>
        <Button variant="secondary" onClick={toggleVoice} aria-label={voice ? t("Turn off examiner voice") : t("Turn on examiner voice")} title={t("Examiner voice")}>
          {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" onClick={() => setDialog("exit")} aria-label={t("Exit test")}>
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t("Exit")}</span>
        </Button>
      </header>

      {started && (
        <div className="h-1.5 bg-slate-200" aria-hidden>
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(index / content.tasks.length) * 100}%` }} />
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        {!started ? (
          <Card className="p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">{t("Before you start")}</h2>
            <p className="mt-2 text-ink-muted">
              {t("The examiner asks each question aloud and your answer is recorded automatically. You answer every question once, as in the real test.")}
            </p>
            <ul className="mt-5 space-y-3">
              {([1, 2, 3] as const).map((p, i) => (
                <li key={p} className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-ink">
                    {t("Part {n}", { n: p })} · {PARTS[p].title}
                  </span>
                  <span className="text-ink-muted"> — {p === 2 ? t("1 cue card") : tn(counts[i], "{n} question", "{n} questions")}</span>
                  <p className="mt-0.5 text-ink-muted">{PARTS[p].about}</p>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-4">
                {stream ? <Mic className="h-6 w-6 text-emerald-500" /> : <MicOff className="h-6 w-6 text-ink-muted" />}
                <div className="min-w-40 flex-1">
                  <div className="font-semibold text-ink">{stream ? t("Microphone is on") : t("Microphone check")}</div>
                  <div className="text-sm text-ink-muted">
                    {stream ? t("Say a few words — the bars should move.") : t("Allow access to your microphone to record answers.")}
                  </div>
                </div>
                {stream ? <LevelMeter level={level} /> : <Button onClick={enableMic}>{t("Turn on microphone")}</Button>}
              </div>
              {micError && (
                <div className="mt-3">
                  <ErrorBox message={micError} />
                </div>
              )}
            </div>

            <p className="mt-4 text-sm text-ink-muted">
              {index > 0
                ? `${t("You've answered {n} of {total} questions — you'll continue from the next one.", { n: index, total: content.tasks.length })} `
                : ""}
              {t("The timer is already running. Find a quiet place and use headphones if you can.")}
            </p>
            <Button className="mt-6 w-full" onClick={start} disabled={!stream}>
              {index > 0 ? t("Continue the test") : t("Start the test")}
            </Button>
          </Card>
        ) : phase === "finishing" ? (
          <Card className="flex flex-col items-center p-10 text-center">
            {error ? (
              <>
                <ErrorBox message={error} />
                <Button className="mt-4" onClick={finish}>
                  {t("Try again")}
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                <p className="mt-3 font-semibold text-ink">{t("Submitting your answers…")}</p>
              </>
            )}
          </Card>
        ) : (
          task && (
            <Card className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
                  {t("Part {n}", { n: task.part })} · {PARTS[task.part].title}
                </span>
                <span className="text-ink-muted">
                  {t("Question {n} of {total}", { n: index + 1, total: content.tasks.length })}
                </span>
              </div>

              {task.part === 2 ? (
                <div className="mt-6 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-5">
                  <p className="text-lg font-bold text-ink">{task.prompt}</p>
                  {task.cue_card_points.length > 0 && (
                    <>
                      <p className="mt-3 text-sm font-semibold text-ink">You should say:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                        {task.cue_card_points.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-6 text-2xl font-bold leading-snug text-ink">{task.prompt}</p>
              )}

              {phase === "prep" && (
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{t("Preparation time")}</span>
                    <span className="text-2xl font-extrabold tabular-nums text-brand-600">{formatSeconds(phaseLeft)}</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    placeholder={t("Make notes here if you wish — they are not saved or marked.")}
                    aria-label={t("Notes")}
                  />
                  <Button className="mt-3 w-full" variant="secondary" onClick={() => startRecording(task)}>
                    {t("I'm ready — start speaking")}
                  </Button>
                </div>
              )}

              {phase === "question" && (
                <p className="mt-6 inline-flex items-center gap-2 text-ink-muted">
                  <Volume2 className="h-5 w-5 animate-pulse text-brand-500" /> {t("Listen to the question… recording starts next.")}
                </p>
              )}

              {phase === "recording" && (
                <div className="mt-6 rounded-xl bg-red-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-2 font-semibold text-red-600">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" /> {t("Recording")}
                    </span>
                    <LevelMeter level={level} />
                    <span className="ml-auto text-2xl font-extrabold tabular-nums text-ink" aria-label={t("Answer time left")}>
                      {formatSeconds(phaseLeft)}
                    </span>
                  </div>
                  <Button className="mt-4 w-full" onClick={stopRecording} disabled={now - phaseStarted < MIN_ANSWER_MS}>
                    {index + 1 < content.tasks.length ? t("Finish answer — next question") : t("Finish answer")}
                  </Button>
                </div>
              )}

              {phase === "uploading" && (
                <p className="mt-6 inline-flex items-center gap-2 text-ink-muted">
                  <Loader2 className="h-5 w-5 animate-spin" /> {t("Saving your answer…")}
                </p>
              )}

              {phase === "upload-error" && (
                <div className="mt-6">
                  <ErrorBox message={error ?? t("Your answer wasn't saved.")} />
                  <Button className="mt-3" onClick={upload}>
                    {t("Try again")}
                  </Button>
                </div>
              )}
            </Card>
          )
        )}
      </main>

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
                {t("Recorded answers are saved; an answer you're giving right now is not. The timer keeps running — when it ends, the test is submitted automatically.")}
              </div>
            </button>
            <button
              onClick={abandon}
              disabled={busy !== null}
              className="w-full rounded-xl border border-red-200 p-4 text-left hover:bg-red-50 disabled:opacity-50"
            >
              <div className="font-semibold text-red-600">{t("Abandon this test")}</div>
              <div className="mt-0.5 text-sm text-ink-muted">{t("The answers won't be assessed and won't count in your progress.")}</div>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
