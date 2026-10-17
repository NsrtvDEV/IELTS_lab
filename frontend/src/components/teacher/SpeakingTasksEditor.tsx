import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import type { TeacherSpeakingTask } from "../../api/student";
import {
  createSpeakingTask,
  deleteSpeakingTask,
  updateSpeakingTask,
  type TeacherSectionContent,
  type TeacherTest,
} from "../../api/teacher";
import { PARTS, formatSeconds } from "../../lib/speaking";
import { isLocked } from "../../lib/tests";
import { Badge, Button, Card, ErrorBox, Label, inputBase, textareaClass } from "../ui";

type Part = 1 | 2 | 3;
const DEFAULT_TIMES: Record<Part, { prep: number; speak: number }> = {
  1: { prep: 0, speak: 30 },
  2: { prep: 60, speak: 120 },
  3: { prep: 0, speak: 60 },
};
const QUESTION_SEC = 10; // пока звучит вопрос — как на сервере (SPEAKING_QUESTION_SEC)
const PLACEHOLDERS: Record<Part, { prompt: string; answer: string }> = {
  1: {
    prompt: "Do you work or are you a student?",
    answer: "I'm a second-year student at the University of Tashkent, where I'm studying economics. I chose it because…",
  },
  2: {
    prompt: "Describe a book that you enjoyed reading.",
    answer: "I'd like to talk about a novel I read last summer called… I came across it when…",
  },
  3: {
    prompt: "Why do you think people read fewer books today than in the past?",
    answer: "I think there are a few reasons. First of all, smartphones have changed how we spend our free time…",
  },
};

function QuestionForm({
  sectionId,
  part,
  task,
  onSaved,
  onCancel,
}: {
  sectionId: number;
  part: Part;
  task?: TeacherSpeakingTask;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [prompt, setPrompt] = useState(task?.prompt ?? "");
  const [points, setPoints] = useState((task?.cue_card_points ?? []).join("\n"));
  const [answer, setAnswer] = useState(task?.sample_answer ?? "");
  const [speak, setSpeak] = useState(String(task?.speak_time_sec ?? DEFAULT_TIMES[part].speak));
  const [prep, setPrep] = useState(String(task?.prep_time_sec ?? DEFAULT_TIMES[part].prep));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = `speaking-${part}-${task?.id ?? "new"}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!prompt.trim()) return setError(part === 2 ? "Write the topic of the card." : "Write the question.");
    if (!answer.trim()) return setError("Write a sample answer — students see it after the test.");
    const input = {
      prompt: prompt.trim(),
      cue_card_points: part === 2 ? points.split("\n").map((p) => p.trim()).filter(Boolean) : [],
      sample_answer: answer.trim(),
      speak_time_sec: Number(speak) || DEFAULT_TIMES[part].speak,
      prep_time_sec: part === 2 ? Number(prep) || 0 : null,
    };
    setSaving(true);
    try {
      if (task) await updateSpeakingTask(task.id, input);
      else await createSpeakingTask(sectionId, { ...input, part });
      onSaved();
      if (!task) {
        setPrompt("");
        setPoints("");
        setAnswer("");
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4">
      <div>
        <Label htmlFor={`${id}-prompt`}>{part === 2 ? "Card topic" : "Question"}</Label>
        <textarea
          id={`${id}-prompt`}
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={textareaClass}
          placeholder={PLACEHOLDERS[part].prompt}
          maxLength={2000}
        />
      </div>
      {part === 2 && (
        <div>
          <Label htmlFor={`${id}-points`}>You should say: (one point per line)</Label>
          <textarea
            id={`${id}-points`}
            rows={4}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className={textareaClass}
            placeholder={"what the book was\nwhen you read it\nwhat it was about\nand explain why you enjoyed it"}
          />
        </div>
      )}
      <div>
        <Label htmlFor={`${id}-answer`}>Sample answer</Label>
        <textarea
          id={`${id}-answer`}
          rows={part === 2 ? 8 : 4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className={textareaClass}
          placeholder={PLACEHOLDERS[part].answer}
          maxLength={5000}
        />
        <p className="mt-1 text-xs text-ink-muted">A model answer at a high band. Students see it only after they submit.</p>
      </div>
      <div className="flex flex-wrap gap-6">
        {part === 2 && (
          <div>
            <Label htmlFor={`${id}-prep`}>Preparation, sec</Label>
            <input id={`${id}-prep`} type="number" min={0} max={300} value={prep} onChange={(e) => setPrep(e.target.value)} className={`${inputBase} w-28`} />
          </div>
        )}
        <div>
          <Label htmlFor={`${id}-speak`}>Answer time, sec</Label>
          <input id={`${id}-speak`} type="number" min={10} max={300} value={speak} onChange={(e) => setSpeak(e.target.value)} className={`${inputBase} w-28`} />
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {task ? "Save" : part === 2 ? "Create the card" : "Add question"}
        </Button>
      </div>
    </form>
  );
}

function QuestionItem({
  task,
  number,
  locked,
  first,
  last,
  onEdit,
  onMove,
  onDelete,
}: {
  task: TeacherSpeakingTask;
  number: number | null;
  locked: boolean;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-3">
      {number !== null && <span className="w-6 shrink-0 pt-0.5 text-sm font-semibold text-ink-muted">{number}.</span>}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{task.prompt}</p>
        {task.cue_card_points.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
            {task.cue_card_points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {task.sample_answer ? (
          <p className="mt-2 flex gap-1.5 text-sm text-ink-muted">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="line-clamp-2">{task.sample_answer}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-amber-700">No sample answer yet</p>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          {task.prep_time_sec > 0 && `${formatSeconds(task.prep_time_sec)} to prepare · `}
          {formatSeconds(task.speak_time_sec)} to answer
        </p>
      </div>
      {!locked && (
        <div className="flex shrink-0 items-start gap-1">
          {number !== null && (
            <>
              <button onClick={() => onMove(-1)} disabled={first} className="rounded p-1.5 text-ink-muted hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button onClick={() => onMove(1)} disabled={last} className="rounded p-1.5 text-ink-muted hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </button>
            </>
          )}
          <button onClick={onEdit} className="rounded p-1.5 text-ink-muted hover:bg-slate-100" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function PartCard({
  sectionId,
  part,
  tasks,
  locked,
  onChanged,
}: {
  sectionId: number;
  part: Part;
  tasks: TeacherSpeakingTask[];
  locked: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const single = part === 2; // одна карточка
  const canAdd = !locked && !(single && tasks.length > 0);

  async function move(index: number, dir: -1 | 1) {
    const order = [...tasks];
    [order[index], order[index + dir]] = [order[index + dir], order[index]];
    try {
      // нумеруем заново всю часть: позиции могли совпадать (например, после админки)
      await Promise.all(order.map((t, i) => (t.position === i ? null : updateSpeakingTask(t.id, { position: i }))));
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(task: TeacherSpeakingTask) {
    if (!window.confirm(single ? "Delete the cue card?" : "Delete this question?")) return;
    try {
      await deleteSpeakingTask(task.id);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const saved = () => {
    setEditing(null);
    onChanged();
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">
          Part {part} <span className="font-medium text-ink-muted">· {PARTS[part].title}</span>
        </h2>
        {tasks.length === 0 ? (
          <Badge color="amber">Not created</Badge>
        ) : (
          <Badge color="green">{single ? "Card ready" : `${tasks.length} question${tasks.length === 1 ? "" : "s"}`}</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {PARTS[part].about}
        {part === 1 && " Usually 8–12 questions on 2–3 topics."}
        {part === 3 && " Usually 4–6 questions."}
      </p>

      {tasks.length > 0 && (
        <ul className="mt-4 space-y-4">
          {tasks.map((t, i) => (
            <li key={t.id} className="border-t border-slate-100 pt-4">
              {editing === t.id ? (
                <QuestionForm sectionId={sectionId} part={part} task={t} onSaved={saved} onCancel={() => setEditing(null)} />
              ) : (
                <QuestionItem
                  task={t}
                  number={single ? null : i + 1}
                  locked={locked}
                  first={i === 0}
                  last={i === tasks.length - 1}
                  onEdit={() => setEditing(t.id)}
                  onMove={(dir) => move(i, dir)}
                  onDelete={() => remove(t)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorBox message={error} />
      {canAdd && (
        <div className="mt-4">
          <QuestionForm key={tasks.length} sectionId={sectionId} part={part} onSaved={onChanged} />
        </div>
      )}
    </Card>
  );
}

/** Редактор секции Speaking: вопросы Part 1–3 с примерными ответами */
export function SpeakingTasksEditor({
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
  const tasks = section.speaking_tasks;
  const needed = tasks.reduce((sum, t) => sum + t.prep_time_sec + t.speak_time_sec + QUESTION_SEC, 0);
  const tooLong = needed > section.duration_min * 60;
  const withoutAnswer = tasks.filter((t) => !t.sample_answer?.trim()).length;

  return (
    <>
      <Link to={`/teacher/tests/${test.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {test.title}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Speaking</h1>
      <p className="mt-1 text-ink-muted">
        {section.duration_min} minutes · {tasks.length} question{tasks.length === 1 ? "" : "s"} · answers take up to {formatSeconds(needed)}
      </p>
      <div className="mt-6 space-y-3">
        {lockedNotice}
        {tooLong && (
          <ErrorBox
            message={`Questions and answers take up to ${formatSeconds(needed)} — set the Speaking time on the test page to at least ${Math.ceil(needed / 60)} min or remove some questions.`}
          />
        )}
        {withoutAnswer > 0 && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {withoutAnswer} question(s) have no sample answer — the test can&apos;t be published until every question has one.
          </p>
        )}
      </div>
      <div className="mt-6 space-y-6">
        {([1, 2, 3] as const).map((part) => (
          <PartCard
            key={part}
            sectionId={section.id}
            part={part}
            tasks={tasks.filter((t) => t.part === part)}
            locked={locked}
            onChanged={onChanged}
          />
        ))}
      </div>
      {!locked && (
        <p className="mt-6 flex items-center gap-1.5 text-sm text-ink-muted">
          <Plus className="h-4 w-4" /> Students answer the questions in this order; the examiner&apos;s voice reads each one aloud.
        </p>
      )}
    </>
  );
}
