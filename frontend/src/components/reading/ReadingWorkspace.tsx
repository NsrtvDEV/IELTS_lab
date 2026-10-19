import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Highlighter } from "lucide-react";
import { resolveMediaUrl } from "../../api/client";
import type { Passage, Question, QuestionGroup } from "../../api/student";
import { isAnswered, type Answer } from "../../lib/answers";
import { scrollToQuestion } from "../../lib/dom";
import { PaneSwitch } from "../PaneSwitch";
import { Button, inputClass } from "../ui";
import { t } from "../../i18n";

// ───────────────────────── Ввод ответа ─────────────────────────

function QuestionInput({
  group,
  question,
  answer,
  onChange,
}: {
  group: QuestionGroup;
  question: Question;
  answer: Answer;
  onChange: (a: Answer) => void;
}) {
  // свои варианты у вопроса (MCQ)
  if (question.options.length > 0) {
    const multi = group.type === "mcq_multi";
    return (
      <div className="mt-2 space-y-1.5">
        {multi && <p className="text-xs text-ink-muted">Choose {question.answers_required}</p>}
        {question.options.map((o) => {
          const checked = answer.options.includes(o.id);
          const toggle = () => {
            if (!multi) return onChange({ text: "", options: [o.id] });
            if (checked) return onChange({ text: "", options: answer.options.filter((x) => x !== o.id) });
            if (answer.options.length < question.answers_required)
              onChange({ text: "", options: [...answer.options, o.id] });
          };
          return (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                checked ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`q-${question.id}`}
                checked={checked}
                onChange={toggle}
                className="mt-0.5 h-4 w-4 accent-brand-500"
              />
              <span>
                <span className="font-semibold">{o.label}</span> {o.text}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  // общий список вариантов группы (TFNG / matching / буквы на схеме)
  if (group.options.length > 0) {
    const short = group.type === "tfng" || group.type === "ynng";
    if (short) {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {group.options.map((o) => {
            const on = answer.options.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ text: "", options: on ? [] : [o.id] })}
                className={`h-9 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset transition ${
                  on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <select
        value={answer.options[0] ?? ""}
        onChange={(e) => onChange({ text: "", options: e.target.value ? [Number(e.target.value)] : [] })}
        className={`${inputClass} mt-2 max-w-xs`}
        aria-label={t("Answer to question {n}", { n: question.number })}
      >
        <option value="">{t("Choose…")}</option>
        {group.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  // ответ словами
  return (
    <input
      value={answer.text}
      onChange={(e) => onChange({ text: e.target.value, options: [] })}
      maxLength={500}
      className={`${inputClass} mt-2 max-w-sm`}
      placeholder={t("Your answer")}
      aria-label={t("Answer to question {n}", { n: question.number })}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

// ───────────────────────── Раскладка с пропусками ─────────────────────────

const GAP = /\{(\d{1,2})\}/g;

/** Поле прямо в тексте формы/таблицы: слово или выбор буквы из списка группы */
function InlineGap({
  group,
  question,
  answer,
  onChange,
  answerKey,
}: {
  group: QuestionGroup;
  question: Question;
  answer: Answer;
  onChange: (a: Answer) => void;
  answerKey?: string[];
}) {
  const box = "h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
  return (
    <span id={`q-${question.number}`} className="mx-0.5 inline-flex scroll-mt-24 items-center gap-1 align-middle">
      <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">{question.number}</span>
      {group.options.length > 0 ? (
        <select
          value={answer.options[0] ?? ""}
          onChange={(e) => onChange({ text: "", options: e.target.value ? [Number(e.target.value)] : [] })}
          className={`${box} w-20`}
          aria-label={t("Answer to question {n}", { n: question.number })}
        >
          <option value="" />
          {group.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={answer.text}
          onChange={(e) => onChange({ text: e.target.value, options: [] })}
          maxLength={500}
          className={`${box} w-36`}
          aria-label={t("Answer to question {n}", { n: question.number })}
          autoComplete="off"
          spellCheck={false}
        />
      )}
      {answerKey && <span className="text-xs font-semibold text-emerald-700">{answerKey.join(" / ")}</span>}
    </span>
  );
}

/** Текст с пропусками {n}: строки с "|" складываются в таблицу */
function TemplateLayout({
  template,
  group,
  answers,
  setAnswer,
  answerKey,
}: {
  template: string;
  group: QuestionGroup;
  answers: Record<number, Answer>;
  setAnswer: (questionId: number, a: Answer) => void;
  answerKey?: Record<number, string[]>;
}) {
  const byNumber = new Map(group.questions.map((q) => [q.number, q]));

  function renderLine(line: string, key: string) {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const m of line.matchAll(GAP)) {
      const q = byNumber.get(Number(m[1]));
      parts.push(line.slice(last, m.index));
      parts.push(
        q ? (
          <InlineGap
            key={`${key}-${q.id}`}
            group={group}
            question={q}
            answer={answers[q.id] ?? { text: "", options: [] }}
            onChange={(a) => setAnswer(q.id, a)}
            answerKey={answerKey?.[q.id]}
          />
        ) : (
          m[0]
        )
      );
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(line.slice(last));
    return parts;
  }

  // соседние строки с "|" — одна таблица, первая строка — заголовок
  const blocks: { table: boolean; lines: string[] }[] = [];
  for (const line of template.split("\n")) {
    const table = line.includes("|");
    const prev = blocks[blocks.length - 1];
    if (prev && prev.table === table) prev.lines.push(line);
    else blocks.push({ table, lines: [line] });
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm leading-8 text-ink">
      {blocks.map((b, bi) =>
        b.table ? (
          <div key={bi} className="overflow-x-auto">
            <table className="w-full border-collapse bg-white text-left">
              <tbody>
                {b.lines.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? "bg-slate-100 font-semibold" : ""}>
                    {row.split("|").map((cell, ci) => (
                      <td key={ci} className="border border-slate-200 px-3 py-1.5 align-top">
                        {renderLine(cell.trim(), `${bi}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div key={bi}>
            {b.lines.map((line, li) => (
              <p key={li} className="min-h-4 whitespace-pre-wrap">
                {renderLine(line, `${bi}-${li}`)}
              </p>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function GroupBlock({
  group,
  answers,
  setAnswer,
  answerKey,
}: {
  group: QuestionGroup;
  answers: Record<number, Answer>;
  setAnswer: (questionId: number, a: Answer) => void;
  answerKey?: Record<number, string[]>; // предпросмотр учителя: правильные ответы под вопросами
}) {
  const showOptionList = group.options.length > 0 && group.type !== "tfng" && group.type !== "ynng";
  const template = typeof group.meta?.template === "string" ? group.meta.template : null;
  // вопросы, у которых есть место в раскладке, показываем в ней, остальные — списком
  const inLayout = new Set(template ? [...template.matchAll(GAP)].map((m) => Number(m[1])) : []);
  const listed = group.questions.filter((q) => !inLayout.has(q.number));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="whitespace-pre-line text-sm font-semibold text-ink">{group.instruction}</p>
      {group.word_limit && (
        <p className="mt-1 text-xs text-ink-muted">
          No more than {group.word_limit} word{group.word_limit > 1 ? "s" : ""}
          {group.allow_number ? " and/or a number" : ""}.
        </p>
      )}
      {group.image_url && (
        <img
          src={resolveMediaUrl(group.image_url)}
          alt={t("Illustration for: {text}", { text: group.instruction })}
          className="mt-3 max-h-[28rem] w-auto max-w-full rounded-lg border border-slate-200"
        />
      )}
      {showOptionList && (
        <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          {group.options.map((o) => (
            <li key={o.id}>
              <span className="font-semibold text-ink">{o.label}</span> <span className="text-ink-muted">{o.text}</span>
            </li>
          ))}
        </ul>
      )}
      {template && (
        <TemplateLayout template={template} group={group} answers={answers} setAnswer={setAnswer} answerKey={answerKey} />
      )}
      <ol className={`${listed.length ? "mt-4" : "hidden"} space-y-5`}>
        {listed.map((q) => (
          <li key={q.id} id={`q-${q.number}`} className="scroll-mt-24">
            <div className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-ink">
                {q.number}
              </span>
              <div className="min-w-0 flex-1">
                {q.text && <p className="text-ink">{q.text}</p>}
                <QuestionInput
                  group={group}
                  question={q}
                  answer={answers[q.id] ?? { text: "", options: [] }}
                  onChange={(a) => setAnswer(q.id, a)}
                />
                {answerKey?.[q.id] && (
                  <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                    {t("Answer:")} {answerKey[q.id].join(group.type === "mcq_multi" ? ", " : " / ")}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────────────────────── Текст с маркером ─────────────────────────

type Range2 = [number, number];

function merge(ranges: Range2[]): Range2[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Range2[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
}

function loadHighlights(key: string | undefined): Range2[] {
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

/** Текст, в котором ученик выделяет слова маркером, как на компьютерном IELTS */
function HighlightedPassage({ passage, storageKey }: { passage: Passage; storageKey?: string }) {
  const key = storageKey ? `${storageKey}:${passage.id}` : undefined;
  const [ranges, setRanges] = useState<Range2[]>(() => loadHighlights(key));
  const [pending, setPending] = useState<{ range: Range2; top: number; left: number } | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const text = passage.text ?? "";

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(ranges));
    } catch {
      // приватный режим — выделения просто не сохранятся
    }
  }, [key, ranges]);

  function onMouseUp() {
    onSelect(false);
  }

  /** below — кнопку «Выделить» ставим под текстом: сверху на телефоне меню браузера */
  function onSelect(below: boolean) {
    const sel = window.getSelection();
    const root = textRef.current;
    if (!sel || sel.isCollapsed || !root || !wrapRef.current) return setPending(null);
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return setPending(null);
    // смещения в исходном тексте: длина текста от начала абзаца до границ выделения
    const before = document.createRange();
    before.setStart(root, 0);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + range.toString().length;
    if (end <= start) return setPending(null);
    const rect = range.getBoundingClientRect();
    const wrap = wrapRef.current.getBoundingClientRect();
    const top = below ? rect.bottom - wrap.top + 12 : rect.top - wrap.top - 44;
    // кнопка шириной ~110px по центру выделения, но не за краями текста
    const left = Math.min(Math.max(rect.left - wrap.left + rect.width / 2, 56), wrap.width - 56);
    setPending({ range: [start, end], top, left });
  }

  // на телефоне выделяют долгим нажатием и ручками — mouseup не приходит, следим за выделением.
  // Подписка одна на всё время (страница перерисовывается каждую секунду из-за таймера),
  // а вызываем всегда свежую onSelect через ref
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onSelectRef.current(true), 300);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  function addHighlight() {
    if (!pending) return;
    setRanges((r) => merge([...r, pending.range]));
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeHighlight(e: MouseEvent, index: number) {
    e.stopPropagation();
    setRanges((r) => r.filter((_, i) => i !== index));
  }

  const parts: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(
      <mark
        key={i}
        onClick={(ev) => removeHighlight(ev, i)}
        className="cursor-pointer rounded-sm bg-amber-200/80 text-ink"
        title={t("Click to remove highlight")}
      >
        {text.slice(s, e)}
      </mark>
    );
    pos = e;
  });
  if (pos < text.length) parts.push(text.slice(pos));

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center justify-between gap-3">
        {passage.title && <h2 className="text-xl font-bold text-ink">{passage.title}</h2>}
        {ranges.length > 0 && (
          <button onClick={() => setRanges([])} className="shrink-0 text-xs font-medium text-ink-muted hover:text-ink">
            {t("Clear highlights")}
          </button>
        )}
      </div>
      <p ref={textRef} onMouseUp={onMouseUp} className="mt-3 whitespace-pre-line text-[15px] leading-7 text-ink">
        {parts}
      </p>
      {pending && (
        <button
          onMouseDown={(e) => e.preventDefault()} // не сбрасываем выделение кликом
          onClick={addHighlight}
          style={{ top: pending.top, left: pending.left }}
          className="absolute z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
        >
          <Highlighter className="h-3.5 w-3.5" /> {t("Highlight")}
        </button>
      )}
    </div>
  );
}

// ───────────────────────── Навигатор ─────────────────────────

/** Номера 1–40 внизу экрана: закрашены отвеченные, клик — переход к вопросу */
export function QuestionNavigator({
  groups,
  answers,
  onJump,
}: {
  groups: QuestionGroup[];
  answers: Record<number, Answer>;
  onJump: (number: number, passageId: number | null) => void;
}) {
  const all = useMemo(
    () =>
      groups
        .flatMap((g) => g.questions.map((q: Question) => ({ q, passageId: g.passage_id })))
        .sort((a, b) => a.q.number - b.q.number),
    [groups]
  );
  const answered = all.filter(({ q }) => isAnswered(answers[q.id])).length;

  return (
    <nav className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-slate-200 bg-white px-4 py-2.5 sm:px-6" aria-label={t("Questions")}>
      <span className="shrink-0 text-xs font-semibold text-ink-muted">
        {answered}/{all.length}
      </span>
      <div className="flex gap-1">
        {all.map(({ q, passageId }) => {
          const done = isAnswered(answers[q.id]);
          return (
            <button
              key={q.id}
              onClick={() => onJump(q.number, passageId)}
              className={`h-8 w-8 shrink-0 rounded-md text-xs font-bold ${
                done ? "bg-brand-500 text-white" : "bg-slate-100 text-ink hover:bg-slate-200"
              }`}
              aria-label={done ? t("Question {n}, answered", { n: q.number }) : t("Question {n}", { n: q.number })}
            >
              {q.number}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ───────────────────────── Рабочая область ─────────────────────────

/** Тексты слева, вопросы справа, навигатор по номерам снизу */
export function ReadingWorkspace({
  passages,
  groups,
  answers,
  onAnswer,
  highlightKey,
  answerKey,
}: {
  passages: Passage[];
  groups: QuestionGroup[];
  answers: Record<number, Answer>;
  onAnswer: (questionId: number, a: Answer) => void;
  highlightKey?: string; // ключ localStorage для выделений; без него не сохраняются
  answerKey?: Record<number, string[]>;
}) {
  const [active, setActive] = useState(0);
  const [pane, setPane] = useState<"text" | "questions">("text"); // на телефоне — по очереди

  const current = passages[active];
  // группы без привязки к тексту показываем вместе с первым текстом
  const groupsHere = groups.filter(
    (g) => g.passage_id === current?.id || (g.passage_id === null && active === 0) || !current
  );

  function jumpTo(number: number, passageId: number | null) {
    const index = passages.findIndex((p) => p.id === passageId);
    setActive(index === -1 ? 0 : index);
    setPane("questions");
    scrollToQuestion(number);
  }

  return (
    <>
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 lg:hidden">
        <PaneSwitch
          value={pane}
          onChange={setPane}
          label={t("Show")}
          options={[
            { value: "text", label: t("Passage {n}", { n: active + 1 }) },
            { value: "questions", label: t("Questions") },
          ]}
        />
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section
          className={`${pane === "text" ? "" : "hidden"} min-h-0 overflow-y-auto bg-white px-5 py-5 sm:px-8 lg:block lg:border-r lg:border-slate-200`}
        >
          <div className="flex flex-wrap gap-2" role="tablist">
            {passages.map((p, i) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  i === active ? "bg-brand-500 text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
                }`}
              >
                {t("Passage {n}", { n: i + 1 })}
              </button>
            ))}
          </div>
          {current && (
            <article className="mt-5">
              <HighlightedPassage key={current.id} passage={current} storageKey={highlightKey} />
            </article>
          )}
          <p className="mt-6 text-xs text-ink-muted">{t("Tip: select words in the text to highlight them.")}</p>
        </section>

        <section className={`${pane === "questions" ? "" : "hidden"} min-h-0 space-y-4 overflow-y-auto bg-[#f7f9fd] px-5 py-5 sm:px-8 lg:block`}>
          {groupsHere.map((g) => (
            <GroupBlock key={g.id} group={g} answers={answers} setAnswer={onAnswer} answerKey={answerKey} />
          ))}
          {active < passages.length - 1 && (
            <Button
              variant="secondary"
              onClick={() => {
                setActive(active + 1);
                setPane("text");
              }}
            >
              {t("Next passage")} →
            </Button>
          )}
        </section>
      </div>

      <QuestionNavigator groups={groups} answers={answers} onJump={jumpTo} />
    </>
  );
}
