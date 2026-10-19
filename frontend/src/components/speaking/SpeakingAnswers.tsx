import { useEffect, useState } from "react";
import { ChevronDown, Lightbulb, MicOff } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { getRecording, type SpeakingTaskResult } from "../../api/student";
import { PARTS, formatSeconds } from "../../lib/speaking";
import { Card } from "../ui";
import { t } from "../../i18n";

/** Запись ответа: файл скачивается с токеном и играет из памяти браузера */
export function RecordingPlayer({ responseId }: { responseId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getRecording(responseId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [responseId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!url) return <div className="h-10 w-full max-w-md animate-pulse rounded-full bg-slate-100" />;
  return <audio controls preload="metadata" src={url} className="h-10 w-full max-w-md" />;
}

/** Примерный ответ учителя — свернут, чтобы сначала послушать себя */
function SampleAnswer({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        aria-expanded={open}
      >
        <Lightbulb className="h-4 w-4" /> {t("Sample answer")}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50/70 p-3 text-sm leading-6 text-ink">{text}</p>}
    </div>
  );
}

/** Вопросы Speaking по частям с записями ответов и примерными ответами */
export function SpeakingAnswers({ tasks }: { tasks: SpeakingTaskResult[] }) {
  return (
    <div className="space-y-5">
      {([1, 2, 3] as const).map((part) => {
        const items = tasks.filter((task) => task.part === part);
        if (!items.length) return null;
        return (
          <Card key={part} className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-ink">
                {t("Part {n}", { n: part })} <span className="font-medium text-ink-muted">· {PARTS[part].title}</span>
              </h3>
            </div>
            <ol className="divide-y divide-slate-100">
              {items.map((task, i) => (
                <li key={task.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-ink">
                      {part !== 2 && <span className="mr-2 text-ink-muted">{i + 1}.</span>}
                      {task.prompt}
                    </p>
                    {task.duration_sec !== null && (
                      <span className="text-xs text-ink-muted">
                        {formatSeconds(task.duration_sec)} / {formatSeconds(task.speak_time_sec)}
                      </span>
                    )}
                  </div>
                  {task.cue_card_points.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                      {task.cue_card_points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    {task.response_id !== null ? (
                      <RecordingPlayer responseId={task.response_id} />
                    ) : (
                      <p className="inline-flex items-center gap-1.5 text-sm italic text-ink-muted">
                        <MicOff className="h-4 w-4" /> {t("No answer recorded")}
                      </p>
                    )}
                  </div>
                  {task.sample_answer && <SampleAnswer text={task.sample_answer} />}
                </li>
              ))}
            </ol>
          </Card>
        );
      })}
    </div>
  );
}
