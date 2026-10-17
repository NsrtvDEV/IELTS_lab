import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import type { WritingTask } from "../../api/student";
import {
  createWritingTask,
  deleteWritingTask,
  updateWritingTask,
  type TeacherSectionContent,
  type TeacherTest,
} from "../../api/teacher";
import { isLocked } from "../../lib/tests";
import { Badge, Button, Card, ErrorBox, Label, inputBase, textareaClass } from "../ui";
import { ImageField } from "./ImageField";

const DEFAULTS: Record<1 | 2, { minWords: number; minutes: number; hint: string; placeholder: string }> = {
  1: {
    minWords: 150,
    minutes: 20,
    hint: "Task 1: describe a graph, table, chart, map or process. Upload the visual below.",
    placeholder:
      "The chart below shows the number of visitors to three museums in London between 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.",
  },
  2: {
    minWords: 250,
    minutes: 40,
    hint: "Task 2: an essay giving an opinion, discussing views or solving a problem.",
    placeholder:
      "Some people believe that university education should be free for everyone. Others think students should pay for it.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.",
  },
};

function TaskForm({
  sectionId,
  number,
  task,
  locked,
  onSaved,
}: {
  sectionId: number;
  number: 1 | 2;
  task?: WritingTask;
  locked: boolean;
  onSaved: () => void;
}) {
  const d = DEFAULTS[number];
  const [prompt, setPrompt] = useState(task?.prompt ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(task?.image_url ?? null);
  const [minWords, setMinWords] = useState(String(task?.min_words ?? d.minWords));
  const [minutes, setMinutes] = useState(String(task?.recommended_min ?? d.minutes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!prompt.trim()) return setError("Write the task for students.");
    const input = {
      prompt: prompt.trim(),
      image_url: imageUrl,
      min_words: Number(minWords) || d.minWords,
      recommended_min: Number(minutes) || d.minutes,
    };
    setSaving(true);
    try {
      if (task) await updateWritingTask(task.id, input);
      else await createWritingTask(sectionId, { ...input, task_number: number });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!task || !window.confirm(`Delete Task ${number}?`)) return;
    try {
      await deleteWritingTask(task.id);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (locked) {
    return (
      <Card className="p-5">
        <h2 className="text-lg font-bold text-ink">Task {number}</h2>
        {task ? (
          <>
            <p className="mt-1 text-sm text-ink-muted">
              At least {task.min_words} words · about {task.recommended_min} min
            </p>
            <p className="mt-3 whitespace-pre-line text-sm text-ink">{task.prompt}</p>
            {task.image_url && <img src={resolveMediaUrl(task.image_url)} alt="" className="mt-3 max-h-64 rounded-lg border border-slate-200" />}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Not created.</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Task {number}</h2>
          {task ? <Badge color="green">Saved</Badge> : <Badge color="amber">Not created</Badge>}
        </div>
        <p className="text-sm text-ink-muted">{d.hint}</p>
        <div>
          <Label htmlFor={`task-${number}-prompt`}>Task for students</Label>
          <textarea
            id={`task-${number}-prompt`}
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={textareaClass}
            placeholder={d.placeholder}
            maxLength={5000}
          />
        </div>
        <ImageField
          value={imageUrl}
          onChange={setImageUrl}
          hint={number === 1 ? "The chart, table, map or process diagram to describe." : "Usually not needed for Task 2."}
        />
        <div className="flex flex-wrap gap-6">
          <div>
            <Label htmlFor={`task-${number}-words`}>Minimum words</Label>
            <input id={`task-${number}-words`} type="number" min={20} max={1000} value={minWords} onChange={(e) => setMinWords(e.target.value)} className={`${inputBase} w-28`} />
          </div>
          <div>
            <Label htmlFor={`task-${number}-minutes`}>Recommended time, min</Label>
            <input id={`task-${number}-minutes`} type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputBase} w-28`} />
          </div>
        </div>
        <ErrorBox message={error} />
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-600">Saved</span>}
          {task && (
            <Button type="button" variant="danger" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button type="submit" loading={saving}>
            {task ? "Save changes" : `Create Task ${number}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Редактор секции Writing: Task 1 и Task 2 */
export function WritingTasksEditor({
  section,
  test,
  onChanged,
  lockedNotice,
}: {
  section: TeacherSectionContent;
  test: TeacherTest;
  onChanged: () => void;
  lockedNotice: ReactNode;
}) {
  const locked = isLocked(test);
  const byNumber = (n: 1 | 2) => section.writing_tasks.find((t) => t.task_number === n);

  return (
    <>
      <Link to={`/teacher/tests/${test.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {test.title}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Writing</h1>
      <p className="mt-1 text-ink-muted">
        {section.duration_min} minutes · Task 2 counts twice as much as Task 1 in the band score
      </p>
      <div className="mt-6">{lockedNotice}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {([1, 2] as const).map((n) => (
          // key с id: после создания/удаления форма пересоздаётся с актуальными данными
          <TaskForm key={`${n}-${byNumber(n)?.id ?? "new"}`} sectionId={section.id} number={n} task={byNumber(n)} locked={locked} onSaved={onChanged} />
        ))}
      </div>
    </>
  );
}
