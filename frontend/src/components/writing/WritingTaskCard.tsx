import { useState } from "react";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { resolveMediaUrl } from "../../api/client";
import type { InlineComment, WritingTaskResult } from "../../api/student";
import { CRITERIA } from "../../lib/writing";
import { Card } from "../ui";
import { AnnotatedEssay } from "./AnnotatedEssay";

/** Задание Writing с текстом ученика, комментариями к фрагментам и (если есть) оценкой по критериям.
 *  onCommentsChange — учитель редактирует комментарии (comments тогда берутся из пропса). */
export function WritingTaskCard({
  task,
  showAssessment = true,
  comments,
  onCommentsChange,
}: {
  task: WritingTaskResult;
  showAssessment?: boolean;
  comments?: InlineComment[];
  onCommentsChange?: (comments: InlineComment[]) => void;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const short = task.word_count < task.min_words;
  const a = task.assessment;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-bold text-ink">Task {task.task_number}</h3>
        <div className="flex items-center gap-3 text-sm">
          <span className={short ? "font-semibold text-amber-700" : "text-ink-muted"}>
            {task.word_count} words{short ? ` · under ${task.min_words}` : ""}
          </span>
          {showAssessment && a && (
            <span className="rounded-lg bg-brand-50 px-3 py-1 font-bold text-brand-700">Band {a.band}</span>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <button
          onClick={() => setPromptOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
          aria-expanded={promptOpen}
        >
          <ChevronDown className={`h-4 w-4 transition ${promptOpen ? "rotate-180" : ""}`} /> Task
        </button>
        {promptOpen && (
          <div className="mt-2 rounded-lg bg-slate-50 p-4 text-sm text-ink">
            <p className="whitespace-pre-line">{task.prompt}</p>
            {task.image_url && (
              <img src={resolveMediaUrl(task.image_url)} alt={`Task ${task.task_number} visual`} className="mt-3 max-h-80 rounded-lg border border-slate-200" />
            )}
          </div>
        )}
        <div className="mt-4">
          {task.text.trim() ? (
            <AnnotatedEssay
              text={task.text}
              comments={comments ?? (showAssessment ? a?.comments : undefined) ?? []}
              onChange={onCommentsChange}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-[15px] italic text-ink-muted">
              No text was written for this task.
            </div>
          )}
        </div>
      </div>

      {showAssessment && a && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {CRITERIA.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-200">
                <span className="text-ink">{c.label(task.task_number)}</span>
                <span className="font-bold text-ink">{a[c.key]}</span>
              </div>
            ))}
          </div>
          {a.feedback && (
            <div className="mt-4 flex gap-3 text-sm">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div>
                <p className="whitespace-pre-line text-ink">{a.feedback}</p>
                {a.grader_name && <p className="mt-1 text-xs text-ink-muted">— {a.grader_name}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
