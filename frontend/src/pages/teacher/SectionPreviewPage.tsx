import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import type { QuestionGroup } from "../../api/student";
import { getSection, type TeacherSectionContent } from "../../api/teacher";
import { ListeningWorkspace } from "../../components/listening/ListeningWorkspace";
import { ReadingWorkspace } from "../../components/reading/ReadingWorkspace";
import type { Answer } from "../../lib/answers";
import { Button, ErrorBox, Spinner } from "../../components/ui";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { t } from "../../i18n";

/** Секция глазами ученика: можно отвечать (ничего не сохраняется) и показать ключ ответов */
export function SectionPreviewPage() {
  const { sectionId } = useParams();
  const [section, setSection] = useState<TeacherSectionContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    getSection(Number(sectionId))
      .then(setSection)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [sectionId]);

  // содержимое учителя -> в том виде, как его получает ученик
  const groups: QuestionGroup[] = useMemo(
    () =>
      (section?.question_groups ?? []).map((g) => ({
        id: g.id,
        passage_id: g.passage_id,
        type: g.type,
        instruction: g.instruction,
        word_limit: g.word_limit,
        allow_number: g.allow_number,
        image_url: g.image_url,
        meta: g.meta,
        options: g.options,
        questions: g.questions.map((q) => ({
          id: q.id,
          number: q.number,
          text: q.text,
          answers_required: q.answers_required,
          meta: q.meta,
          options: q.options,
        })),
      })),
    [section]
  );
  const answerKey = useMemo(() => {
    const key: Record<number, string[]> = {};
    for (const g of section?.question_groups ?? [])
      for (const q of g.questions) key[q.id] = [...q.correct_options, ...q.correct_texts];
    return key;
  }, [section]);

  if (!section) return <div className="p-8">{error ? <ErrorBox message={error} /> : <Spinner />}</div>;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-amber-50 px-4 sm:px-6">
        <Link to={`/teacher/sections/${section.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {t("Back to editor")}
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
          <Eye className="h-4 w-4" /> {t("Preview · {section} — answers aren't saved", { section: SECTION_LABELS[section.type] })}
        </span>
        <Button variant="secondary" className="ml-auto" onClick={() => setShowKey((v) => !v)} aria-pressed={showKey}>
          {showKey ? t("Hide answer key") : t("Show answer key")}
        </Button>
      </header>
      {section.type === "listening" ? (
        <ListeningWorkspace
          parts={section.passages}
          groups={groups}
          answers={answers}
          onAnswer={(id, a) => setAnswers((prev) => ({ ...prev, [id]: a }))}
          answerKey={showKey ? answerKey : undefined}
          freePlayback
        />
      ) : (
        <ReadingWorkspace
          passages={section.passages}
          groups={groups}
          answers={answers}
          onAnswer={(id, a) => setAnswers((prev) => ({ ...prev, [id]: a }))}
          answerKey={showKey ? answerKey : undefined}
        />
      )}
    </div>
  );
}
