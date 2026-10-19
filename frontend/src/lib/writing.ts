import type { CriteriaScores } from "../api/student";
import { t } from "../i18n";

/** Как на сервере (app/utils.count_words): слова разделены пробелами и переносами */
export function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Четыре официальных критерия Writing; первый называется по-разному в Task 1 и Task 2 */
export const CRITERIA: { key: keyof CriteriaScores; label: (task: number) => string; short: string }[] = [
  { key: "task_response", label: (n) => (n === 1 ? t("Task Achievement") : t("Task Response")), short: "TA/TR" },
  { key: "coherence_cohesion", label: () => t("Coherence & Cohesion"), short: "CC" },
  { key: "lexical_resource", label: () => t("Lexical Resource"), short: "LR" },
  { key: "grammatical_range", label: () => t("Grammatical Range & Accuracy"), short: "GRA" },
];

/** Округление band по правилам IELTS: до ближайших 0.5 (.25 → .5, .75 → следующее целое) */
export function roundBand(value: number) {
  return Math.round(value * 2) / 2;
}

export function taskBand(scores: CriteriaScores) {
  return roundBand((scores.task_response + scores.coherence_cohesion + scores.lexical_resource + scores.grammatical_range) / 4);
}

/** Band секции: Task 2 весит вдвое больше Task 1 */
export function writingBand(task1: number, task2: number) {
  return roundBand((task1 + 2 * task2) / 3);
}
