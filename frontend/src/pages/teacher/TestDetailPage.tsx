import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Headphones,
  Lock,
  Mic,
  PenLine,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import {
  deleteTest,
  getTest,
  publishTest,
  renameTest,
  unpublishTest,
  updateSectionDuration,
  type SectionType,
  type TeacherSection,
  type TeacherTest,
} from "../../api/teacher";
import { Button, Card, ErrorBox, Spinner, inputBase, inputClass } from "../../components/ui";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { isLocked } from "../../lib/tests";
import { TestStatus } from "./TestsPage";

const SECTION_ICONS: Record<SectionType, LucideIcon> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};

export function LockedNotice({ test }: { test: TeacherTest }) {
  if (!isLocked(test)) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      {test.has_attempts
        ? "Students have already taken this test, so its content can't be changed."
        : "The test is published. Unpublish it to edit the content."}
    </div>
  );
}

function SectionRow({
  section,
  locked,
  onDurationSaved,
}: {
  section: TeacherSection;
  locked: boolean;
  onDurationSaved: () => void;
}) {
  const Icon = SECTION_ICONS[section.type];
  const [duration, setDuration] = useState(String(section.duration_min));
  const [error, setError] = useState<string | null>(null);
  const hasQuestions = section.type === "listening" || section.type === "reading";

  async function saveDuration() {
    const value = Number(duration);
    if (value === section.duration_min) return;
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      setError("1–180 min");
      setDuration(String(section.duration_min));
      return;
    }
    try {
      await updateSectionDuration(section.id, value);
      setError(null);
      onDurationSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setDuration(String(section.duration_min));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
        <Icon className="h-5 w-5 text-brand-500" />
      </span>
      <div className="min-w-40 flex-1">
        <div className="font-semibold text-ink">{SECTION_LABELS[section.type]}</div>
        <div className="text-sm text-ink-muted">
          {hasQuestions
            ? `${section.question_count} of 40 questions`
            : section.type === "writing"
              ? "Task 1 and Task 2"
              : "Part 1–3 questions with sample answers"}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="number"
          min={1}
          max={180}
          value={duration}
          disabled={locked}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={saveDuration}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className={`${inputBase} w-20 text-center`}
          aria-label={`${SECTION_LABELS[section.type]} duration, minutes`}
        />
        min
      </label>
      {error && <span className="text-sm text-red-600">{error}</span>}
      <Link to={`/teacher/sections/${section.id}`}>
        <Button variant="secondary">
          {locked ? "View" : hasQuestions || section.type === "speaking" ? "Edit questions" : "Edit tasks"}
        </Button>
      </Link>
    </div>
  );
}

export function TestDetailPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<TeacherTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<"publish" | "delete" | null>(null);

  async function load() {
    try {
      setTest(await getTest(Number(testId)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  if (!test) {
    return error ? <ErrorBox message={error} /> : <Spinner />;
  }
  const locked = isLocked(test);

  async function saveTitle() {
    if (!test || !title.trim() || title.trim() === test.title) {
      setEditingTitle(false);
      return;
    }
    try {
      setTest(await renameTest(test.id, title.trim()));
      setEditingTitle(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function togglePublish() {
    if (!test) return;
    setBusy("publish");
    setError(null);
    try {
      setTest(test.is_published ? await unpublishTest(test.id) : await publishTest(test.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!test || !window.confirm(`Delete "${test.title}"? This can't be undone.`)) return;
    setBusy("delete");
    try {
      await deleteTest(test.id);
      navigate("/teacher/tests");
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(null);
    }
  }

  return (
    <>
      <Link to="/teacher/tests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All tests
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              maxLength={255}
              className={`${inputClass} h-12 max-w-xl text-2xl font-bold`}
              aria-label="Test title"
            />
          ) : (
            <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
              {test.title}
              <button
                onClick={() => {
                  setTitle(test.title);
                  setEditingTitle(true);
                }}
                className="rounded-md p-1.5 text-ink-muted hover:bg-slate-100 hover:text-ink"
                aria-label="Rename test"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </h1>
          )}
          <div className="mt-2">
            <TestStatus test={test} />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" onClick={remove} loading={busy === "delete"} disabled={test.has_attempts}
            title={test.has_attempts ? "Students already took this test" : undefined}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button
            variant={test.is_published ? "secondary" : "primary"}
            onClick={togglePublish}
            loading={busy === "publish"}
            disabled={!test.is_published && test.problems.length > 0}
          >
            {test.is_published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ErrorBox message={error} />
        <LockedNotice test={test} />

        {!test.is_published && (
          <Card className="p-5">
            {test.problems.length === 0 ? (
              <p className="flex items-center gap-2 font-semibold text-emerald-700">
                <CheckCircle2 className="h-5 w-5" /> The test is complete and ready to publish.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-amber-700">
                  <AlertTriangle className="h-5 w-5" /> Before publishing:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
                  {test.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        <Card className="divide-y divide-slate-100">
          {test.sections.map((s) => (
            <SectionRow key={s.id} section={s} locked={locked} onDurationSaved={load} />
          ))}
        </Card>
      </div>
    </>
  );
}
