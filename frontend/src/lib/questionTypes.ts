import type { QuestionType, SectionType } from "../api/teacher";

export const SECTION_LABELS: Record<SectionType, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple choice (one answer)",
  mcq_multi: "Multiple choice (several answers)",
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
  matching_headings: "Matching headings",
  matching_info: "Matching information",
  matching_features: "Matching features",
  matching_sentence_endings: "Matching sentence endings",
  sentence_completion: "Sentence completion",
  summary_completion: "Summary completion",
  note_completion: "Note completion",
  form_completion: "Form completion",
  table_completion: "Table completion",
  flow_chart_completion: "Flow-chart completion",
  gap_fill: "Gap fill",
  short_answer: "Short answer",
  diagram_label: "Diagram labelling",
  map_label: "Map / plan labelling",
};

/** Как ученик отвечает и как учитель задаёт правильный ответ — повторяет app/content.py */
export type AnswerMode =
  | "fixed" // TFNG/YNNG: варианты создаются сами
  | "question-options" // MCQ: свои варианты у каждого вопроса
  | "group-options" // matching: общий список вариантов
  | "text" // short answer: только словами
  | "either"; // completion, схема, карта: словами или выбор из списка (буквы)

export function answerMode(type: QuestionType): AnswerMode {
  if (type === "tfng" || type === "ynng") return "fixed";
  if (type === "mcq" || type === "mcq_multi") return "question-options";
  if (type.startsWith("matching_")) return "group-options";
  if (type === "short_answer") return "text";
  return "either";
}

export const FIXED_OPTIONS: Partial<Record<QuestionType, string[]>> = {
  tfng: ["TRUE", "FALSE", "NOT GIVEN"],
  ynng: ["YES", "NO", "NOT GIVEN"],
};

/** Следующая буква/номер варианта: A, B, C… или i, ii, iii… */
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
export function nextLabel(existing: string[], roman = false): string {
  if (roman) return ROMAN.find((r) => !existing.includes(r)) ?? String(existing.length + 1);
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!existing.includes(letter)) return letter;
  }
  return String(existing.length + 1);
}

// цвета секций в графиках — проверены валидатором dataviz (CVD и контраст; подписи обязательны)
export const SECTION_COLORS: Record<SectionType, string> = {
  reading: "#2f6bff",
  listening: "#10b981",
  writing: "#8b5cf6",
  speaking: "#f26b6b",
};
