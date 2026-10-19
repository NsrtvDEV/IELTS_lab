import { useEffect, useRef, useState } from "react";
import { Headphones, Play, RotateCcw, Volume2 } from "lucide-react";
import { resolveMediaUrl } from "../../api/client";
import type { Passage, PlaybackState } from "../../api/student";
import { Button } from "../ui";
import { t, tn } from "../../i18n";

type Status = "idle" | "loading" | "playing" | "blocked" | "finished" | "error";

const START: PlaybackState = { part: 0, position: 0, finished: false };
const SERVER_SAVE_EVERY_SEC = 5;

/** Что дальше по записи: дослушанное > более поздняя часть > большее время */
function furthest(a: PlaybackState, b: PlaybackState) {
  if (a.finished !== b.finished) return a.finished ? a : b;
  if (a.part !== b.part) return a.part > b.part ? a : b;
  return a.position >= b.position ? a : b;
}

function loadLocal(key: string | undefined): PlaybackState {
  try {
    if (key) return { ...START, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    // нет доступа к localStorage — опираемся на сервер
  }
  return START;
}

function saveLocal(key: string | undefined, value: PlaybackState) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватный режим — останется сохранение на сервере
  }
}

function clock(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Короткий тон, чтобы проверить наушники и громкость до начала записи */
function playTestTone(volume: number) {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 440;
  gain.gain.value = 0.25 * volume;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1);
  osc.onended = () => ctx.close();
}

/**
 * Запись как на экзамене: все части подряд, один раз, без паузы и перемотки.
 * Место воспроизведения хранится на сервере (и в браузере): после перезагрузки,
 * очистки данных или на другом устройстве запись продолжается, а не начинается заново.
 */
export function ExamPlayer({
  parts,
  initial,
  storageKey,
  onSave,
  onPartChange,
}: {
  parts: Passage[];
  initial: PlaybackState | null; // с сервера
  storageKey?: string;
  onSave?: (state: PlaybackState) => Promise<PlaybackState>;
  onPartChange: (index: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [saved] = useState(() => furthest(initial ?? START, loadLocal(storageKey)));
  const [part, setPart] = useState(saved.part);
  const [status, setStatus] = useState<Status>(saved.finished ? "finished" : "idle");
  const [time, setTime] = useState(saved.position);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const lastServerSave = useRef(saved.position);
  const resumeAt = useRef(saved.position);

  const playable = parts.map((p, i) => ({ p, i })).filter(({ p }) => p.audio_url);
  const current = parts[part];
  const position = playable.findIndex(({ i }) => i === part) + 1;
  const knownTotal = playable.every(({ p }) => p.audio_duration_sec)
    ? playable.reduce((sum, { p }) => sum + (p.audio_duration_sec ?? 0), 0)
    : null;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function store(state: PlaybackState, toServer: boolean) {
    saveLocal(storageKey, state);
    if (!toServer || !onSave) return;
    onSave(state)
      .then((server) => {
        // запись уже дослушана в другом окне/устройстве
        if (server.finished && !state.finished) {
          audioRef.current?.pause();
          saveLocal(storageKey, server);
          setStatus("finished");
        }
      })
      .catch(() => undefined); // сеть — сохраним при следующем шаге
  }

  function play(index: number, at: number) {
    const audio = audioRef.current;
    const src = resolveMediaUrl(parts[index]?.audio_url);
    if (!audio || !src) return;
    setPart(index);
    onPartChange(index);
    resumeAt.current = at;
    setStatus("loading");
    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    } else if (at > 0) {
      audio.currentTime = at;
    }
    audio.play().catch((err: DOMException) =>
      // мобильный браузер не дал включить звук без нажатия — просим нажать
      setStatus(err.name === "NotAllowedError" ? "blocked" : "error")
    );
  }

  function next() {
    const following = playable.find(({ i }) => i > part);
    if (following) {
      store({ part: following.i, position: 0, finished: false }, true);
      lastServerSave.current = 0;
      play(following.i, 0);
    } else {
      store({ part, position: 0, finished: true }, true);
      setStatus("finished");
    }
  }

  function start() {
    // первая часть с записью, если сохранённая без аудио
    const first = parts[part]?.audio_url ? part : playable[0]?.i;
    if (first === undefined) return setStatus("error");
    play(first, first === part ? resumeAt.current : 0);
  }

  const notStarted = status === "idle" && saved.part === 0 && saved.position === 0;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6" role="region" aria-label={t("Recording")}>
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          if (resumeAt.current > 0) e.currentTarget.currentTime = resumeAt.current;
        }}
        onPlaying={() => setStatus("playing")}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          const toServer = Math.abs(t - lastServerSave.current) >= SERVER_SAVE_EVERY_SEC;
          if (toServer) lastServerSave.current = t;
          store({ part, position: t, finished: false }, toServer);
        }}
        // паузу из системы (наушники, клавиши) отменяем — на экзамене запись не останавливается
        onPause={(e) => {
          if (status === "playing" && !e.currentTarget.ended)
            e.currentTarget.play().catch(() => setStatus("blocked"));
        }}
        onEnded={next}
        onError={() => setStatus("error")}
      />

      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
          <Headphones className="h-5 w-5 text-brand-500" />
        </span>

        {status === "idle" && (
          <>
            <div className="min-w-48 flex-1 text-sm">
              <div className="font-semibold text-ink">
                {notStarted
                  ? t("The recording plays once") + (knownTotal ? ` · ${tn(playable.length, "{n} part", "{n} parts")}, ${clock(knownTotal)}` : "")
                  : t("Part {n} was interrupted", { n: part + 1 })}
              </div>
              <div className="text-ink-muted">
                {notStarted
                  ? t("All parts play one after another — no pause or replay. The timer is already running: test your sound and start.")
                  : t("Continue from where it stopped.")}
              </div>
            </div>
            {notStarted && (
              <Button variant="secondary" onClick={() => playTestTone(volume)}>
                <Volume2 className="h-4 w-4" /> {t("Test sound")}
              </Button>
            )}
            <Button onClick={start}>
              <Play className="h-4 w-4" /> {notStarted ? t("Start listening") : t("Resume")}
            </Button>
          </>
        )}

        {(status === "playing" || status === "loading") && current && (
          <div className="min-w-48 flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">
                {t("Part {n}", { n: part + 1 })}{" "}
                <span className="font-normal text-ink-muted">· {t("recording {n} of {total}", { n: position, total: playable.length })}</span>
              </span>
              <span className="tabular-nums text-ink-muted">
                {status === "loading" ? t("Loading…") : `${clock(time)} / ${clock(duration)}`}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={t("Part {n} progress", { n: part + 1 })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={duration ? Math.round((time / duration) * 100) : 0}
            >
              <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }} />
            </div>
          </div>
        )}

        {status === "blocked" && (
          <>
            <div className="min-w-48 flex-1 text-sm">
              <div className="font-semibold text-ink">{t("Tap to continue")}</div>
              <div className="text-ink-muted">{t("Your browser paused the sound. It continues from the same place.")}</div>
            </div>
            <Button onClick={() => play(part, time || resumeAt.current)}>
              <Play className="h-4 w-4" /> {t("Continue Part {n}", { n: part + 1 })}
            </Button>
          </>
        )}

        {status === "finished" && (
          <div className="flex-1 text-sm">
            <div className="font-semibold text-ink">{t("The recording has finished")}</div>
            <div className="text-ink-muted">{t("Check your answers and submit when you're ready.")}</div>
          </div>
        )}

        {status === "error" && (
          <>
            <div className="min-w-48 flex-1 text-sm">
              <div className="font-semibold text-red-600">{t("The recording couldn't play")}</div>
              <div className="text-ink-muted">{t("Check your connection and try again — it continues from the same place.")}</div>
            </div>
            <Button variant="secondary" onClick={() => play(part, time || resumeAt.current)}>
              <RotateCcw className="h-4 w-4" /> {t("Try again")}
            </Button>
          </>
        )}

        <label className="flex items-center gap-2 text-ink-muted">
          <Volume2 className="h-4 w-4" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24 accent-brand-500"
            aria-label={t("Volume")}
          />
        </label>
      </div>
    </div>
  );
}

/** Все записи с обычными плеерами — для предпросмотра учителя и разбора после сдачи */
export function FreePlayers({ parts }: { parts: Passage[] }) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2">
        {parts.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-semibold text-ink">{t("Part {n}", { n: i + 1 })}</span>
            {p.audio_url ? (
              <audio controls preload="none" src={resolveMediaUrl(p.audio_url)} className="h-9 w-full" />
            ) : (
              <span className="text-sm text-red-600">{t("no audio")}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
