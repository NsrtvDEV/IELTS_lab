import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import {
  createQuestionGroup,
  replaceQuestionGroup,
  uploadImage,
  type OptionInput,
  type QuestionGroupInput,
  type QuestionType,
  type TeacherQuestionGroup,
  type TeacherSectionContent,
} from "../../api/teacher";
import {
  FIXED_OPTIONS,
  QUESTION_TYPE_LABELS,
  answerMode,
  nextLabel,
} from "../../lib/questionTypes";
import { Button, ErrorBox, Label, inputBase, inputClass, textareaClass } from "../ui";

interface DraftQuestion {
  key: number; // стабильный ключ для React, номер вопроса может меняться
  number: string;
  text: string;
  answersRequired: number;
  options: OptionInput[];
  correctOptions: string[];
  correctTexts: string[];
}

let keySeq = 0;

function emptyQuestion(number: number): DraftQuestion {
  return {
    key: ++keySeq,
    number: String(number),
    text: "",
    answersRequired: 1,
    options: [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ],
    correctOptions: [],
    correctTexts: [],
  };
}

function firstFreeNumber(taken: number[]): number {
  for (let n = 1; n <= 40; n++) if (!taken.includes(n)) return n;
  return 40;
}

// ───────────────────────── Мелкие поля ─────────────────────────

/** Правильные текстовые ответы: Enter или запятая добавляет вариант написания */
function AnswerTags({
  values,
  onChange,
  id,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  id: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-800">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={values.length ? "Another spelling…" : "Type the answer and press Enter"}
        className="min-w-40 flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  roman = false,
}: {
  options: OptionInput[];
  onChange: (options: OptionInput[]) => void;
  roman?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={o.label}
            onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            className={`${inputBase} w-16 shrink-0 text-center font-semibold`}
            aria-label="Option label"
            maxLength={10}
          />
          <input
            value={o.text}
            onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            className={inputClass}
            placeholder="Option text"
            aria-label={`Option ${o.label} text`}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="rounded-lg px-2 text-ink-muted hover:bg-slate-100 hover:text-red-600"
            aria-label={`Remove option ${o.label}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => onChange([...options, { label: nextLabel(options.map((o) => o.label), roman), text: "" }])}
      >
        <Plus className="h-4 w-4" /> Add option
      </Button>
    </div>
  );
}

/** Выбор правильных вариантов кнопками-буквами */
function CorrectPicker({
  labels,
  selected,
  max,
  onChange,
}: {
  labels: string[];
  selected: string[];
  max: number;
  onChange: (selected: string[]) => void;
}) {
  function toggle(label: string) {
    if (selected.includes(label)) onChange(selected.filter((l) => l !== label));
    else if (max === 1) onChange([label]);
    else if (selected.length < max) onChange([...selected, label]);
  }
  if (!labels.length) {
    return <p className="text-sm text-ink-muted">Add options first.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => {
        const on = selected.includes(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => toggle(label)}
            aria-pressed={on}
            className={`h-9 min-w-9 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset transition ${
              on ? "bg-emerald-500 text-white ring-emerald-500" : "bg-white text-ink ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Картинка к группе: схема, карта, таблица, flow-chart */
function ImageField({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label>Image (optional)</Label>
      <p className="mb-2 text-sm text-ink-muted">A diagram, map, table or flow-chart the questions refer to.</p>
      {value ? (
        <div className="relative inline-block">
          <img src={resolveMediaUrl(value)} alt="Question group" className="max-h-56 rounded-lg border border-slate-200" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-ink-muted shadow hover:text-red-600"
            aria-label="Remove image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-sm text-ink-muted hover:border-brand-300 hover:bg-brand-50/40">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {uploading ? "Uploading…" : "Upload PNG, JPG, WEBP or SVG (up to 5 MB)"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={uploading}
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// задания, где пропуски стоят внутри формы, таблицы, заметок или текста
const LAYOUT_TYPES: QuestionType[] = [
  "form_completion",
  "note_completion",
  "table_completion",
  "flow_chart_completion",
  "summary_completion",
  "sentence_completion",
  "gap_fill",
];

/** Раскладка с пропусками: "Name: {1}" — на месте {1} ученик увидит поле для вопроса 1 */
function LayoutField({
  value,
  onChange,
  numbers,
}: {
  value: string;
  onChange: (v: string) => void;
  numbers: number[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null); // где был курсор; null — в поле ещё не кликали
  const used = new Set([...value.matchAll(/\{(\d{1,2})\}/g)].map((m) => Number(m[1])));

  function insert(n: number) {
    const el = ref.current;
    const at = Math.min(caret.current ?? value.length, value.length);
    const next = `${value.slice(0, at)}{${n}}${value.slice(at)}`;
    onChange(next);
    window.setTimeout(() => {
      el?.focus();
      const pos = at + String(n).length + 2;
      el?.setSelectionRange(pos, pos);
      caret.current = pos;
    }, 0);
  }

  return (
    <div>
      <Label htmlFor="group-layout">Layout with gaps (optional)</Label>
      <p className="mb-2 text-sm text-ink-muted">
        Write the form, notes, table or summary and put <code className="rounded bg-slate-100 px-1">{"{5}"}</code> where the
        gap for question 5 goes. Use <code className="rounded bg-slate-100 px-1">|</code> between table columns. Without a
        layout, questions are shown as a list.
      </p>
      <textarea
        id="group-layout"
        ref={ref}
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={(e) => (caret.current = e.currentTarget.selectionStart)}
        className={`${textareaClass} font-mono text-[13px]`}
        placeholder={"ACCOMMODATION BOOKING FORM\nName: Mr {1}\nArrival date: {2} March\n\nRoom | Price | Extras\nDouble | £{3} | {4}"}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-muted">Insert gap:</span>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => insert(n)}
            disabled={used.has(n)}
            className="h-7 min-w-7 rounded-md bg-slate-100 px-2 text-xs font-bold text-ink hover:bg-brand-50 hover:text-brand-700 disabled:cursor-default disabled:bg-emerald-50 disabled:text-emerald-700"
            title={used.has(n) ? "Already in the layout" : `Insert {${n}}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Форма ─────────────────────────

/** meta группы с раскладкой (или без неё) — остальные ключи meta сохраняем */
function withLayout(meta: Record<string, unknown> | null, template: string) {
  const rest = { ...(meta ?? {}) };
  delete rest.template;
  if (template) rest.template = template;
  return Object.keys(rest).length ? rest : null;
}

function fromGroup(group: TeacherQuestionGroup): DraftQuestion[] {
  return group.questions.map((q) => ({
    key: ++keySeq,
    number: String(q.number),
    text: q.text ?? "",
    answersRequired: q.answers_required,
    options: q.options.map((o) => ({ label: o.label, text: o.text })),
    correctOptions: q.correct_options,
    correctTexts: q.correct_texts,
  }));
}

export function QuestionGroupForm({
  section,
  group,
  onSaved,
  onCancel,
}: {
  section: TeacherSectionContent;
  group?: TeacherQuestionGroup; // есть — редактирование, нет — новая группа
  onSaved: () => void;
  onCancel: () => void;
}) {
  // номера, занятые другими группами (свои номера при редактировании свободны)
  const takenByOthers = section.question_numbers.filter(
    (n) => !group?.questions.some((q) => q.number === n)
  );

  const [type, setType] = useState<QuestionType>(group?.type ?? "tfng");
  const [passageId, setPassageId] = useState<number | null>(
    group ? group.passage_id : section.passages[0]?.id ?? null
  );
  const [instruction, setInstruction] = useState(group?.instruction ?? "");
  const [wordLimit, setWordLimit] = useState(group?.word_limit ? String(group.word_limit) : "");
  const [allowNumber, setAllowNumber] = useState(group?.allow_number ?? false);
  const [position, setPosition] = useState(String(group?.position ?? section.question_groups.length));
  const [imageUrl, setImageUrl] = useState<string | null>(group?.image_url ?? null);
  const [layout, setLayout] = useState<string>((group?.meta?.template as string | undefined) ?? "");
  const [groupOptions, setGroupOptions] = useState<OptionInput[]>(
    group && !FIXED_OPTIONS[group.type] ? group.options.map((o) => ({ label: o.label, text: o.text })) : []
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    group ? fromGroup(group) : [emptyQuestion(firstFreeNumber(takenByOthers))]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mode = answerMode(type);
  // completion/схема/карта: есть общий список — отвечают буквой, нет — словами
  const usesOptions =
    mode === "fixed" || mode === "question-options" || mode === "group-options" || (mode === "either" && groupOptions.length > 0);
  const usesText = !usesOptions;

  function updateQuestion(key: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    const used = [...takenByOthers, ...questions.map((q) => Number(q.number))];
    const last = Math.max(0, ...questions.map((q) => Number(q.number) || 0));
    const next = last < 40 && !used.includes(last + 1) ? last + 1 : firstFreeNumber(used);
    const q = emptyQuestion(next);
    // для MCQ берём набор букв как у предыдущего вопроса
    const prev = questions[questions.length - 1];
    if (prev) q.options = prev.options.map((o) => ({ label: o.label, text: "" }));
    setQuestions((qs) => [...qs, q]);
  }

  function changeType(next: QuestionType) {
    setType(next);
    // правильные варианты другого вида теряют смысл при смене типа
    setQuestions((qs) => qs.map((q) => ({ ...q, correctOptions: [], answersRequired: next === "mcq_multi" ? Math.max(2, q.answersRequired) : 1 })));
    if (answerMode(next) === "group-options" && groupOptions.length === 0) {
      const roman = next === "matching_headings";
      setGroupOptions([
        { label: roman ? "i" : "A", text: "" },
        { label: roman ? "ii" : "B", text: "" },
        { label: roman ? "iii" : "C", text: "" },
      ]);
    }
  }

  function labelsFor(q: DraftQuestion): string[] {
    if (mode === "fixed") return FIXED_OPTIONS[type] ?? [];
    if (mode === "question-options") return q.options.map((o) => o.label).filter(Boolean);
    return groupOptions.map((o) => o.label).filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: QuestionGroupInput = {
      passage_id: passageId,
      type,
      instruction: instruction.trim(),
      word_limit: usesText && wordLimit ? Number(wordLimit) : null,
      allow_number: usesText && allowNumber,
      position: Number(position) || 0,
      image_url: imageUrl,
      meta: withLayout(group?.meta ?? null, LAYOUT_TYPES.includes(type) ? layout.trim() : ""),
      options: mode === "group-options" || mode === "either" ? groupOptions : [],
      questions: questions.map((q) => ({
        number: Number(q.number),
        text: q.text.trim() || null,
        answers_required: type === "mcq_multi" ? q.answersRequired : 1,
        options: mode === "question-options" ? q.options : [],
        correct_options: usesOptions ? q.correctOptions : [],
        correct_texts: usesText ? q.correctTexts : [],
      })),
    };

    if (!payload.instruction) return setError("Write the instruction for students.");
    const missing = payload.questions.find((q) =>
      usesOptions ? q.correct_options.length === 0 : q.correct_texts.length === 0
    );
    if (missing) return setError(`Question ${missing.number}: choose the correct answer.`);

    setSaving(true);
    try {
      if (group) await replaceQuestionGroup(group.id, payload);
      else await createQuestionGroup(section.id, payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  }

  const passageName = (i: number) => (section.type === "listening" ? `Part ${i + 1}` : `Passage ${i + 1}`);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
        <div>
          <Label htmlFor="group-type">Question type</Label>
          <select id="group-type" value={type} onChange={(e) => changeType(e.target.value as QuestionType)} className={inputClass}>
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="group-passage">{section.type === "listening" ? "Recording" : "Passage"}</Label>
          <select
            id="group-passage"
            value={passageId ?? ""}
            onChange={(e) => setPassageId(e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          >
            <option value="">— not linked —</option>
            {section.passages.map((p, i) => (
              <option key={p.id} value={p.id}>
                {passageName(i)}
                {p.title ? `: ${p.title}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="group-position">Order</Label>
          <input id="group-position" type="number" min={0} value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <Label htmlFor="group-instruction">Instruction for students</Label>
        <textarea
          id="group-instruction"
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className={textareaClass}
          placeholder={
            usesText
              ? "Questions 1–5. Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer."
              : "Questions 1–5. Do the following statements agree with the information given in the passage?"
          }
        />
      </div>

      {usesText && (
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <Label htmlFor="group-word-limit">Word limit</Label>
            <input
              id="group-word-limit"
              type="number"
              min={1}
              max={10}
              value={wordLimit}
              onChange={(e) => setWordLimit(e.target.value)}
              className={`${inputBase} w-28`}
              placeholder="no limit"
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={allowNumber} onChange={(e) => setAllowNumber(e.target.checked)} className="h-4 w-4 rounded accent-brand-500" />
            “AND/OR A NUMBER” — a number doesn&apos;t count as a word
          </label>
        </div>
      )}

      {mode === "fixed" && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink-muted">
          Students choose from <strong className="text-ink">{FIXED_OPTIONS[type]?.join(" / ")}</strong> — the options are added automatically.
        </p>
      )}

      <ImageField value={imageUrl} onChange={setImageUrl} />

      {LAYOUT_TYPES.includes(type) && (
        <LayoutField
          value={layout}
          onChange={setLayout}
          numbers={questions.map((q) => Number(q.number)).filter((n) => n > 0).sort((a, b) => a - b)}
        />
      )}

      {(mode === "group-options" || mode === "either") && (
        <div>
          <Label>
            {mode === "group-options"
              ? "Options shared by all questions"
              : type === "diagram_label" || type === "map_label"
                ? "Letters on the diagram / map (optional)"
                : "Word list to choose from (optional)"}
          </Label>
          {mode === "either" && (
            <p className="mb-2 text-sm text-ink-muted">
              Leave empty if students write the answer themselves. With a list, they choose a letter.
            </p>
          )}
          <OptionsEditor options={groupOptions} onChange={setGroupOptions} roman={type === "matching_headings"} />
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-ink">Questions ({questions.length})</h3>
        </div>
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex gap-3">
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={q.number}
                  onChange={(e) => updateQuestion(q.key, { number: e.target.value })}
                  className={`${inputBase} w-16 shrink-0 text-center font-bold`}
                  aria-label="Question number"
                />
                <input
                  value={q.text}
                  onChange={(e) => updateQuestion(q.key, { text: e.target.value })}
                  className={inputClass}
                  placeholder={usesText ? "Sentence with a gap: The hive holds about ____ bees." : "Question or statement"}
                  aria-label={`Question ${q.number} text`}
                />
                {type === "mcq_multi" && (
                  <select
                    value={q.answersRequired}
                    onChange={(e) => updateQuestion(q.key, { answersRequired: Number(e.target.value), correctOptions: [] })}
                    className={`${inputBase} w-36 shrink-0`}
                    aria-label="How many answers"
                  >
                    {[2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        Choose {n}
                      </option>
                    ))}
                  </select>
                )}
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                    className="rounded-lg px-2 text-ink-muted hover:bg-slate-100 hover:text-red-600"
                    aria-label={`Remove question ${q.number}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {mode === "question-options" && (
                <div className="mt-3 pl-[4.75rem]">
                  <OptionsEditor options={q.options} onChange={(options) => updateQuestion(q.key, { options, correctOptions: q.correctOptions.filter((l) => options.some((o) => o.label === l)) })} />
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 pl-[4.75rem]">
                <span className="text-sm font-semibold text-ink-muted">Correct:</span>
                <div className="min-w-0 flex-1">
                  {usesOptions ? (
                    <CorrectPicker
                      labels={labelsFor(q)}
                      selected={q.correctOptions}
                      max={type === "mcq_multi" ? q.answersRequired : 1}
                      onChange={(correctOptions) => updateQuestion(q.key, { correctOptions })}
                    />
                  ) : (
                    <AnswerTags id={`answers-${q.key}`} values={q.correctTexts} onChange={(correctTexts) => updateQuestion(q.key, { correctTexts })} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-3" onClick={addQuestion}>
          <Plus className="h-4 w-4" /> Add question
        </Button>
      </div>

      <ErrorBox message={error} />
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {group ? "Save changes" : "Add questions"}
        </Button>
      </div>
    </form>
  );
}
