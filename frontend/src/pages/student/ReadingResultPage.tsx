import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiErrorMessage } from "../../api/client";
import { getReadingResult, type SectionResult } from "../../api/student";
import { ResultView } from "../../components/results/ResultView";
import { ErrorBox, Spinner } from "../../components/ui";

export function ReadingResultPage() {
  const { sectionAttemptId } = useParams();
  const [result, setResult] = useState<SectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReadingResult(Number(sectionAttemptId))
      .then(setResult)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [sectionAttemptId]);

  if (!result) return error ? <ErrorBox message={error} /> : <Spinner />;
  return <ResultView result={result} backTo="/" backLabel="All tests" />;
}
