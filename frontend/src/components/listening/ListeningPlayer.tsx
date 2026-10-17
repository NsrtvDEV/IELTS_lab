import { useEffect, useRef, useState } from "react";
import { Headphones, Play, RotateCcw, Volume2 } from "lucide-react";
import { resolveMediaUrl } from "../../api/client";
import type { Passage } from "../../api/student";
import { Button } from "../ui";

type Saved = { part: number; time: number; finished: boolean };
type Status = "idle" | "loading" | "playing" | "finished" | "error";

function load(key: string | undefined): Saved {
  try {
    if (key) return { part: 0, time: 0, finished: false, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    // нет доступа к localStorage — начинаем с начала
  }
  return { part: 0, time: 0, finished: false };
}

function persist(key: string | undefined, value: Saved) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватный режим — прогресс записи просто не сохранится
  }
}

function clock(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Запись как на экзамене: все части подряд, один раз, без паузы и перемотки.
 * Место воспроизведения сохраняется — после перезагрузки продолжаем с него, а не с начала.
 */
export function ExamPlayer({
  parts,
  storageKey,
  onPartChange,
}: {
  parts: Passage[];
  storageKey?: string;
  onPartChange: (index: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [saved] = useState(() => load(storageKey));
  const [part, setPart] = useState(saved.part);
  const [status, setStatus] = useState<Status>(saved.finished ? "finished" : "idle");
  const [time, setTime] = useState(saved.time);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const lastSaved = useRef(0);
  const resumeAt = useRef(saved.time);

  const playable = parts.map((p, i) => ({ p, i })).filter(({ p }) => p.audio_url);
  const current = parts[part];
  const position = playable.findIndex(({ i }) => i === part) + 1;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function play(index: number, at: number) {
    const audio = audioRef.current;
    const src = resolveMediaUrl(parts[index]?.audio_url);
    if (!audio || !src) return;
    setPart(index);
    onPartChange(index);
    resumeAt.current = at;
    setStatus("loading");
    audio.src = src;
    audio.load();
    audio.play().catch(() => setStatus("error"));
  }

  function next() {
    const following = playable.find(({ i }) => i > part);
    if (following) {
      persist(storageKey, { part: following.i, time: 0, finished: false });
      play(following.i, 0);
    } else {
      persist(storageKey, { part, time: 0, finished: true });
      setStatus("finished");
    }
  }

  function start() {
    // первая часть с записью, если сохранённая без аудио
    const first = parts[part]?.audio_url ? part : playable[0]?.i;
    if (first === undefined) return setStatus("error");
    play(first, first === part ? resumeAt.current : 0);
  }

  const notStarted = status === "idle" && saved.part === 0 && saved.time === 0;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6" role="region" aria-label="Recording">
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
          if (Math.abs(t - lastSaved.current) >= 2) {
            lastSaved.current = t;
            persist(storageKey, { part, time: t, finished: false });
          }
        }}
        // паузу из системы (наушники, клавиши) отменяем — на экзамене запись не останавливается
        onPause={(e) => {
          if (status === "playing" && !e.currentTarget.ended) e.currentTarget.play().catch(() => setStatus("error"));
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
                {notStarted ? "The recording plays once" : `Part ${part + 1} was interrupted`}
              </div>
              <div className="text-ink-muted">
                {notStarted
                  ? "All parts play one after another. You can't pause or replay it — read the questions first."
                  : "Continue from where it stopped."}
              </div>
            </div>
            <Button onClick={start}>
              <Play className="h-4 w-4" /> {notStarted ? "Start listening" : "Resume"}
            </Button>
          </>
        )}

        {(status === "playing" || status === "loading") && current && (
          <div className="min-w-48 flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">
                Part {part + 1} <span className="font-normal text-ink-muted">· recording {position} of {playable.length}</span>
              </span>
              <span className="tabular-nums text-ink-muted">
                {status === "loading" ? "Loading…" : `${clock(time)} / ${clock(duration)}`}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={`Part ${part + 1} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={duration ? Math.round((time / duration) * 100) : 0}
            >
              <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }} />
            </div>
          </div>
        )}

        {status === "finished" && (
          <div className="flex-1 text-sm">
            <div className="font-semibold text-ink">The recording has finished</div>
            <div className="text-ink-muted">Check your answers and submit when you&apos;re ready.</div>
          </div>
        )}

        {status === "error" && (
          <>
            <div className="min-w-48 flex-1 text-sm">
              <div className="font-semibold text-red-600">The recording couldn&apos;t play</div>
              <div className="text-ink-muted">Check your connection and try again — it continues from the same place.</div>
            </div>
            <Button variant="secondary" onClick={() => play(part, time || resumeAt.current)}>
              <RotateCcw className="h-4 w-4" /> Try again
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
            aria-label="Volume"
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
            <span className="w-14 shrink-0 text-sm font-semibold text-ink">Part {i + 1}</span>
            {p.audio_url ? (
              <audio controls preload="none" src={resolveMediaUrl(p.audio_url)} className="h-9 w-full" />
            ) : (
              <span className="text-sm text-red-600">no audio</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
