/** Ответ ученика на вопрос: текст или выбранные варианты */
export type Answer = { text: string; options: number[] };

export function isAnswered(a: Answer | undefined) {
  return !!a && (a.text.trim() !== "" || a.options.length > 0);
}
