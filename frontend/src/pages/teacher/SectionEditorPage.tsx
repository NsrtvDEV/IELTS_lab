import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye, FileAudio, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import {
  deletePassage,
  deleteQuestionGroup,
  getSection,
  getTest,
  type TeacherPassage,
  type TeacherQuestionGroup,
  type TeacherSectionContent,
  type TeacherTest,
} from "../../api/teacher";
import { PassageForm } from "../../components/teacher/PassageForm";
import { QuestionGroupForm } from "../../components/teacher/QuestionGroupForm";
import { SpeakingTasksEditor } from "../../components/teacher/SpeakingTasksEditor";
import { WritingTasksEditor } from "../../components/teacher/WritingTasksEditor";
import { Badge, Button, Card, ErrorBox, Modal, Spinner } from "../../components/ui";
import { QUESTION_TYPE_LABELS, SECTION_LABELS } from "../../lib/questionTypes";
import { isLocked } from "../../lib/tests";
import { LockedNotice } from "./TestDetailPage";

function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Недостающие номера 1–40 диапазонами: "5–12, 20, 31–40" */
function missingRanges(taken: number[]): string {
  const ranges: string[] = [];
  let start: number | null = null;
  for (let n = 1; n <= 41; n++) {
    const missing = n <= 40 && !taken.includes(n);
    if (missing && start === null) start = n;
    if (!missing && start !== null) {
      ranges.push(start === n - 1 ? `${start}` : `${start}–${n - 1}`);
      start = null;
    }
  }
  return ranges.join(", ");
}

type Editing =
  | { kind: "passage"; passage?: TeacherPassage }
  | { kind: "group"; group?: TeacherQuestionGroup }
  | null;

function GroupCard({
  group,
  passageName,
  locked,
  onEdit,
  onDelete,
}: {
  group: TeacherQuestionGroup;
  passageName: string | null;
  locked: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const numbers = group.questions.map((q) => q.number);
  const range = numbers.length > 1 ? `${Math.min(...numbers)}–${Math.max(...numbers)}` : `${numbers[0]}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">Questions {range}</span>
            <Badge color="blue">{QUESTION_TYPE_LABELS[group.type]}</Badge>
            {passageName && <Badge color="gray">{passageName}</Badge>}
            {group.word_limit && (
              <Badge color="amber">
                ≤ {group.word_limit} word{group.word_limit > 1 ? "s" : ""}
                {group.allow_number ? " + number" : ""}
              </Badge>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{group.instruction}</p>
          {group.image_url && (
            <img src={resolveMediaUrl(group.image_url)} alt="" className="mt-3 max-h-40 rounded-lg border border-slate-200" />
          )}
        </div>
        {!locked && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 hover:text-ink" aria-label={`Edit questions ${range}`}>
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onDelete} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete questions ${range}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {group.options.length > 0 && !["tfng", "ynng"].includes(group.type) && (
        <ul className="mt-3 grid gap-1 rounded-lg bg-slate-50 px-4 py-3 text-sm sm:grid-cols-2">
          {group.options.map((o) => (
            <li key={o.id}>
              <span className="font-semibold text-ink">{o.label}</span> <span className="text-ink-muted">{o.text}</span>
            </li>
          ))}
        </ul>
      )}

      <ol className="mt-4 space-y-2">
        {group.questions.map((q) => (
          <li key={q.id} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-ink">
              {q.number}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-ink">{q.text || <em className="text-ink-muted">no text</em>}</span>
              {q.options.length > 0 && (
                <span className="ml-2 text-ink-muted">({q.options.map((o) => `${o.label}. ${o.text}`).join("; ")})</span>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {[...q.correct_options, ...q.correct_texts].map((a) => (
                  <span key={a} className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function SectionEditorPage() {
  const { sectionId } = useParams();
  const [section, setSection] = useState<TeacherSectionContent | null>(null);
  const [test, setTest] = useState<TeacherTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  async function load() {
    try {
      const content = await getSection(Number(sectionId));
      setSection(content);
      setTest(await getTest(content.test_id));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  if (!section || !test) {
    return error ? <ErrorBox message={error} /> : <Spinner />;
  }

  if (section.type === "writing") {
    return <WritingTasksEditor section={section} test={test} onChanged={load} lockedNotice={<LockedNotice test={test} />} />;
  }
  if (section.type === "speaking") {
    return <SpeakingTasksEditor section={section} test={test} onChanged={load} lockedNotice={<LockedNotice test={test} />} />;
  }

  const locked = isLocked(test);
  const listening = section.type === "listening";
  const passageName = (id: number | null) => {
    const i = section.passages.findIndex((p) => p.id === id);
    return i === -1 ? null : listening ? `Part ${i + 1}` : `Passage ${i + 1}`;
  };
  const count = section.question_numbers.length;
  // Listening: секция должна вмещать все записи + 2 минуты на проверку ответов
  const durations = section.passages.filter((p) => p.audio_url).map((p) => p.audio_duration_sec);
  const totalAudio = durations.length && durations.every((d) => d) ? durations.reduce<number>((a, d) => a + (d ?? 0), 0) : null;
  const neededMin = totalAudio !== null ? Math.ceil((totalAudio + 120) / 60) : null;
  const tooShort = neededMin !== null && section.duration_min < neededMin;

  async function removePassage(p: TeacherPassage) {
    if (!window.confirm("Delete this passage? Its questions will stay but lose the link to it.")) return;
    try {
      await deletePassage(p.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removeGroup(g: TeacherQuestionGroup) {
    if (!window.confirm(`Delete ${g.questions.length} question(s)?`)) return;
    try {
      await deleteQuestionGroup(g.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function saved() {
    setEditing(null);
    load();
  }

  return (
    <>
      <Link to={`/teacher/tests/${test.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {test.title}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{SECTION_LABELS[section.type]}</h1>
          <p className="mt-1 text-ink-muted">
            {section.duration_min} minutes · {count} of 40 questions
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${count === 40 ? "bg-emerald-500" : "bg-brand-500"}`}
              style={{ width: `${Math.min(100, (count / 40) * 100)}%` }}
            />
          </div>
          {count < 40 && (
            <p className="mt-1.5 text-right text-xs text-ink-muted">
              Missing: {missingRanges(section.question_numbers)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ErrorBox message={error} />
        <LockedNotice test={test} />
        {listening && totalAudio !== null && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${tooShort ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-ink-muted"}`}
          >
            Recordings last <strong>{formatDuration(totalAudio)}</strong>. Section time is {section.duration_min} min
            {tooShort
              ? ` — set it to at least ${neededMin} min on the test page (recordings + 2 min to check answers).`
              : " — enough for the recordings and 2 minutes to check answers."}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* тексты / записи */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">{listening ? "Recordings" : "Passages"}</h2>
            {!locked && (
              <Button variant="ghost" className="h-8 px-2" onClick={() => setEditing({ kind: "passage" })}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {section.passages.length === 0 && (
              <Card className="px-5 py-8 text-center text-sm text-ink-muted">
                {listening ? "Add the recordings for Parts 1–4." : "Add Reading Passages 1–3."}
              </Card>
            )}
            {section.passages.map((p, i) => {
              const Icon = listening ? FileAudio : FileText;
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {listening ? `Part ${i + 1}` : `Passage ${i + 1}`}
                        {listening && p.audio_duration_sec ? ` · ${formatDuration(p.audio_duration_sec)}` : ""}
                      </div>
                      <div className="truncate font-semibold text-ink">{p.title || "Untitled"}</div>
                      {listening ? (
                        p.audio_url ? (
                          <audio controls preload="none" src={resolveMediaUrl(p.audio_url)} className="mt-2 h-9 w-full" />
                        ) : (
                          <p className="mt-1 text-sm font-medium text-red-600">No recording yet</p>
                        )
                      ) : (
                        <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{p.text}</p>
                      )}
                    </div>
                    {!locked && (
                      <div className="flex">
                        <button onClick={() => setEditing({ kind: "passage", passage: p })} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-ink" aria-label="Edit passage">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => removePassage(p)} className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete passage">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* группы вопросов */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">Questions</h2>
            <div className="flex gap-2">
              {count > 0 && (
                <Link to={`/teacher/sections/${section.id}/preview`}>
                  <Button variant="secondary" className="h-9">
                    <Eye className="h-4 w-4" /> Preview
                  </Button>
                </Link>
              )}
              {!locked && count < 40 && (
                <Button className="h-9" onClick={() => setEditing({ kind: "group" })}>
                  <Plus className="h-4 w-4" /> Add questions
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {section.question_groups.length === 0 && (
              <Card className="px-5 py-12 text-center text-sm text-ink-muted">
                No questions yet. Questions are added in groups with one instruction — for example
                “Questions 1–5, TRUE / FALSE / NOT GIVEN”.
              </Card>
            )}
            {section.question_groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                passageName={passageName(g.passage_id)}
                locked={locked}
                onEdit={() => setEditing({ kind: "group", group: g })}
                onDelete={() => removeGroup(g)}
              />
            ))}
          </div>
        </section>
      </div>

      {editing?.kind === "passage" && (
        <Modal
          title={editing.passage ? "Edit" : listening ? "Add recording" : "Add passage"}
          onClose={() => setEditing(null)}
          wide={!listening}
        >
          <PassageForm
            sectionId={section.id}
            sectionType={section.type}
            passage={editing.passage}
            nextPosition={section.passages.length}
            onSaved={saved}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {editing?.kind === "group" && (
        <Modal title={editing.group ? "Edit questions" : "Add questions"} onClose={() => setEditing(null)} wide>
          <QuestionGroupForm section={section} group={editing.group} onSaved={saved} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
