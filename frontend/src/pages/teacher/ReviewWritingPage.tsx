import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import type { CriteriaScores } from "../../api/student";
import { assessWriting, getReviewWriting, type ReviewDetail } from "../../api/teacher";
import { WritingTaskCard } from "../../components/writing/WritingTaskCard";
import { Button, Card, ErrorBox, Label, Spinner, textareaClass } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import { CRITERIA, taskBand, writingBand } from "../../lib/writing";

type Draft = Record<number, CriteriaScores & { feedback: string }>; // по task_id
const BANDS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

function initialDraft(detail: ReviewDetail): Draft {
  const draft: Draft = {};
  for (const t of detail.tasks) {
    const a = t.assessment;
    draft[t.task_id] = {
      task_response: a?.task_response ?? -1,
      coherence_cohesion: a?.coherence_cohesion ?? -1,
      lexical_resource: a?.lexical_resource ?? -1,
      grammatical_range: a?.grammatical_range ?? -1,
      feedback: a?.feedback ?? "",
    };
  }
  return draft;
}

const complete = (s: CriteriaScores) => CRITERIA.every((c) => s[c.key] >= 0);

export function ReviewWritingPage() {
  const { sectionAttemptId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReviewWriting(Number(sectionAttemptId))
      .then((d) => {
        setDetail(d);
        setDraft(initialDraft(d));
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [sectionAttemptId]);

  if (!detail) return error ? <ErrorBox message={error} /> : <Spinner />;

  const bands = detail.tasks.map((t) => (draft[t.task_id] && complete(draft[t.task_id]) ? taskBand(draft[t.task_id]) : null));
  const t1 = detail.tasks.findIndex((t) => t.task_number === 1);
  const t2 = detail.tasks.findIndex((t) => t.task_number === 2);
  const overall = bands[t1] != null && bands[t2] != null ? writingBand(bands[t1]!, bands[t2]!) : null;
  const ready = bands.every((b) => b !== null);

  function setScore(taskId: number, key: keyof CriteriaScores, value: number) {
    setDraft((d) => ({ ...d, [taskId]: { ...d[taskId], [key]: value } }));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await assessWriting(
        detail!.section_attempt_id,
        detail!.tasks.map((t) => ({ task_id: t.task_id, ...draft[t.task_id], feedback: draft[t.task_id].feedback.trim() || null }))
      );
      navigate("/teacher/review");
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <Link to="/teacher/review" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Review queue
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{detail.student_name}</h1>
          <p className="mt-1 text-ink-muted">
            Writing · {detail.test_title} · submitted {detail.submitted_at ? timeAgo(detail.submitted_at) : "—"}
            {detail.band_score && ` · current band ${detail.band_score}`}
          </p>
        </div>
        <Link to={`/teacher/students/${detail.student_id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Student profile →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          {detail.tasks.map((t) => (
            <WritingTaskCard key={t.task_id} task={t} showAssessment={false} />
          ))}
        </div>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          {detail.tasks.map((t, i) => (
            <Card key={t.task_id} className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-ink">Task {t.task_number}</h2>
                <span className="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                  Band {bands[i]?.toFixed(1) ?? "—"}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {CRITERIA.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3">
                    <label htmlFor={`${t.task_id}-${c.key}`} className="text-sm text-ink">
                      {c.label(t.task_number)}
                    </label>
                    <select
                      id={`${t.task_id}-${c.key}`}
                      value={draft[t.task_id]?.[c.key] ?? -1}
                      onChange={(e) => setScore(t.task_id, c.key, Number(e.target.value))}
                      className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    >
                      <option value={-1}>—</option>
                      {BANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Label htmlFor={`${t.task_id}-feedback`}>Feedback</Label>
                <textarea
                  id={`${t.task_id}-feedback`}
                  rows={4}
                  value={draft[t.task_id]?.feedback ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [t.task_id]: { ...d[t.task_id], feedback: e.target.value } }))}
                  className={textareaClass}
                  placeholder="What was done well and what to improve…"
                />
              </div>
            </Card>
          ))}

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Writing band</span>
              <span className="text-3xl font-extrabold text-brand-600">{overall?.toFixed(1) ?? "—"}</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">Task band = average of 4 criteria; Task 2 counts twice.</p>
            <ErrorBox message={error} />
            <Button className="mt-4 w-full" onClick={save} loading={saving} disabled={!ready}>
              {detail.band_score ? "Update assessment" : "Save assessment"}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
