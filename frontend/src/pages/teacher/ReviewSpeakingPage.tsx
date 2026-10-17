import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import type { SpeakingScores } from "../../api/student";
import { assessSpeaking, getReviewSpeaking, type SpeakingReviewDetail } from "../../api/teacher";
import { SpeakingAnswers } from "../../components/speaking/SpeakingAnswers";
import { Button, Card, ErrorBox, Label, Spinner, textareaClass } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import { SPEAKING_CRITERIA, speakingBand } from "../../lib/speaking";

const BANDS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const EMPTY: SpeakingScores = { fluency_coherence: -1, lexical_resource: -1, grammatical_range: -1, pronunciation: -1 };

export function ReviewSpeakingPage() {
  const { sectionAttemptId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SpeakingReviewDetail | null>(null);
  const [scores, setScores] = useState<SpeakingScores>(EMPTY);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReviewSpeaking(Number(sectionAttemptId))
      .then((d) => {
        setDetail(d);
        if (d.assessment) {
          const { fluency_coherence, lexical_resource, grammatical_range, pronunciation } = d.assessment;
          setScores({ fluency_coherence, lexical_resource, grammatical_range, pronunciation });
          setFeedback(d.assessment.feedback ?? "");
        }
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [sectionAttemptId]);

  if (!detail) return error ? <ErrorBox message={error} /> : <Spinner />;

  const ready = SPEAKING_CRITERIA.every((c) => scores[c.key] >= 0);
  const band = ready ? speakingBand(scores) : null;
  const answered = detail.tasks.filter((t) => t.response_id !== null).length;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await assessSpeaking(detail!.section_attempt_id, { ...scores, feedback: feedback.trim() || null });
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
            Speaking · {detail.test_title} · submitted {detail.submitted_at ? timeAgo(detail.submitted_at) : "—"} ·{" "}
            {answered} of {detail.tasks.length} questions answered
            {detail.band_score && ` · current band ${detail.band_score}`}
          </p>
        </div>
        <Link to={`/teacher/students/${detail.student_id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Student profile →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <SpeakingAnswers tasks={detail.tasks} />

        <Card className="p-5 xl:sticky xl:top-24 xl:self-start">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Assessment</h2>
            <span className="text-3xl font-extrabold text-brand-600">{band?.toFixed(1) ?? "—"}</span>
          </div>
          <div className="mt-4 space-y-3">
            {SPEAKING_CRITERIA.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <label htmlFor={`speaking-${c.key}`} className="text-sm text-ink">
                  {c.label}
                </label>
                <select
                  id={`speaking-${c.key}`}
                  value={scores[c.key]}
                  onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
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
            <Label htmlFor="speaking-feedback">Feedback</Label>
            <textarea
              id="speaking-feedback"
              rows={5}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className={textareaClass}
              placeholder="What was done well and what to improve…"
            />
          </div>
          <p className="mt-2 text-xs text-ink-muted">Speaking band = average of the 4 criteria.</p>
          <ErrorBox message={error} />
          <Button className="mt-4 w-full" onClick={save} loading={saving} disabled={!ready}>
            {detail.band_score ? "Update assessment" : "Save assessment"}
          </Button>
        </Card>
      </div>
    </>
  );
}
