import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Hourglass, MessageSquareText } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { getSpeakingResult, type SpeakingResult } from "../../api/student";
import { SpeakingAnswers } from "../../components/speaking/SpeakingAnswers";
import { Card, ErrorBox, Spinner } from "../../components/ui";
import { SPEAKING_CRITERIA } from "../../lib/speaking";
import { t } from "../../i18n";

export function SpeakingResultPage() {
  const { sectionAttemptId } = useParams();
  const [result, setResult] = useState<SpeakingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpeakingResult(Number(sectionAttemptId))
      .then(setResult)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [sectionAttemptId]);

  if (!result) return error ? <ErrorBox message={error} /> : <Spinner />;
  const a = result.assessment;

  return (
    <>
      <Link to="/tests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t("All tests")}
      </Link>

      <Card className="mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-brand-600">Speaking · {result.test_title}</p>
            {!a ? (
              <>
                <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
                  <Hourglass className="h-7 w-7 text-amber-500" /> {t("Waiting for assessment")}
                </h1>
                <p className="mt-2 max-w-xl text-ink-muted">
                  {t("Your answers were sent to a teacher. You'll see the band, the score for each criterion and feedback here once they're checked.")}
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{t("Your Speaking has been assessed")}</h1>
                <p className="mt-2 text-ink-muted">{t("The Speaking band is the average of the four criteria.")}</p>
              </>
            )}
          </div>
          {a && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-brand-50 px-8 py-5">
              <span className="text-sm font-medium text-brand-700">{t("Band score")}</span>
              <span className="text-5xl font-extrabold text-brand-600">{result.band_score}</span>
            </div>
          )}
        </div>

        {a && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {SPEAKING_CRITERIA.map((c) => (
                <div key={c.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-ink">{c.label}</span>
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

      <h2 className="mt-8 text-lg font-bold text-ink">{t("Your answers")}</h2>
      <div className="mt-3">
        <SpeakingAnswers tasks={result.tasks} />
      </div>
    </>
  );
}
