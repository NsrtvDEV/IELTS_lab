import { useState } from "react";
import type { Passage, PlaybackState, QuestionGroup } from "../../api/student";
import type { Answer } from "../../lib/answers";
import { scrollToQuestion } from "../../lib/dom";
import { GroupBlock, QuestionNavigator } from "../reading/ReadingWorkspace";
import { ExamPlayer, FreePlayers } from "./ListeningPlayer";
import { t } from "../../i18n";

/** Плеер сверху, вопросы текущей части по центру, навигатор по номерам снизу */
export function ListeningWorkspace({
  parts,
  groups,
  answers,
  onAnswer,
  playbackKey,
  initialPlayback = null,
  onSavePlayback,
  answerKey,
  freePlayback = false,
}: {
  parts: Passage[];
  groups: QuestionGroup[];
  answers: Record<number, Answer>;
  onAnswer: (questionId: number, a: Answer) => void;
  playbackKey?: string; // ключ localStorage для места воспроизведения
  initialPlayback?: PlaybackState | null; // место воспроизведения с сервера
  onSavePlayback?: (state: PlaybackState) => Promise<PlaybackState>;
  answerKey?: Record<number, string[]>;
  freePlayback?: boolean; // предпросмотр: обычные плееры без ограничений
}) {
  // вопросы открываются на части, где остановилась запись
  const [active, setActive] = useState(initialPlayback && !initialPlayback.finished ? initialPlayback.part : 0);
  const current = parts[active];
  // вопросы без привязки к записи показываем в первой части
  const groupsHere = groups.filter(
    (g) => g.passage_id === current?.id || (g.passage_id === null && active === 0) || !current
  );

  function jumpTo(number: number, passageId: number | null) {
    const index = parts.findIndex((p) => p.id === passageId);
    setActive(index === -1 ? 0 : index);
    scrollToQuestion(number);
  }

  return (
    <>
      {freePlayback ? (
        <FreePlayers parts={parts} />
      ) : (
        <ExamPlayer
          parts={parts}
          initial={initialPlayback}
          storageKey={playbackKey}
          onSave={onSavePlayback}
          onPartChange={setActive}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f9fd]">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
          {/* части можно листать: на экзамене вопросы разрешено читать заранее */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("Parts")}>
            {parts.map((p, i) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  i === active ? "bg-brand-500 text-white" : "bg-white text-ink-muted ring-1 ring-inset ring-slate-200 hover:text-ink"
                }`}
              >
                {t("Part {n}", { n: i + 1 })}
              </button>
            ))}
          </div>
          {current?.title && <h2 className="text-lg font-bold text-ink">{current.title}</h2>}
          {groupsHere.map((g) => (
            <GroupBlock key={g.id} group={g} answers={answers} setAnswer={onAnswer} answerKey={answerKey} />
          ))}
          {groupsHere.length === 0 && <p className="text-sm text-ink-muted">{t("No questions in this part.")}</p>}
        </div>
      </div>

      <QuestionNavigator groups={groups} answers={answers} onJump={jumpTo} />
    </>
  );
}
