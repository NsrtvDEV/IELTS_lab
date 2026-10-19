import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Hourglass } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { getWritingResult, type WritingResult } from "../../api/student";
import { WritingTaskCard } from "../../components/writing/WritingTaskCard";
import { Card, ErrorBox, Spinner } from "../../components/ui";

export function WritingResultPage() {
  const { sectionAttemptId } = useParams();
  const [result, setResult] = useState<WritingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWritingResult(Number(sectionAttemptId))
      .then(setResult)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [sectionAttemptId]);

  if (!result) return error ? <ErrorBox message={error} /> : <Spinner />;
  const pending = result.status === "pending";

  return (
    <>
      <Link to="/tests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All tests
      </Link>

      <Card className="mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-brand-600">Writing · {result.test_title}</p>
            {pending ? (
              <>
                <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
                  <Hourglass className="h-7 w-7 text-amber-500" /> Waiting for assessment
                </h1>
                <p className="mt-2 max-w-xl text-ink-muted">
                  Your essays were sent to a teacher. You&apos;ll see the band, the score for each criterion and feedback here
                  once they&apos;re checked.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Your Writing has been assessed</h1>
                <p className="mt-2 text-ink-muted">Task 2 counts twice as much as Task 1 in the Writing band.</p>
              </>
            )}
          </div>
          {!pending && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-brand-50 px-8 py-5">
              <span className="text-sm font-medium text-brand-700">Band score</span>
              <span className="text-5xl font-extrabold text-brand-600">{result.band_score}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 space-y-5">
        {result.tasks.map((t) => (
          <WritingTaskCard key={t.task_id} task={t} />
        ))}
      </div>
    </>
  );
}
