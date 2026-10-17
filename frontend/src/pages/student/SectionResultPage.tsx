import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiErrorMessage } from "../../api/client";
import { getSectionResult, type QuestionSection, type SectionResult } from "../../api/student";
import { ResultView } from "../../components/results/ResultView";
import { ErrorBox, Spinner } from "../../components/ui";

export function SectionResultPage({ section }: { section: QuestionSection }) {
  const { sectionAttemptId } = useParams();
  const [result, setResult] = useState<SectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSectionResult(section, Number(sectionAttemptId))
      .then(setResult)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [section, sectionAttemptId]);

  if (!result) return error ? <ErrorBox message={error} /> : <Spinner />;
  return <ResultView result={result} backTo="/" backLabel="All tests" />;
}
