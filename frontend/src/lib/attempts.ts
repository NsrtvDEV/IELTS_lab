// Попытки ученика: что можно продолжить и куда идти после сдачи секции
import { listAttempts, type Attempt, type AvailableSection } from "../api/student";

export const isMock = (a: Attempt) => a.section_type === null;

/** Попытка, которую надо закончить: секция начата и не сдана или полный экзамен ждёт следующую секцию */
export function isUnfinished(a: Attempt) {
  if (a.status !== "in_progress") return false;
  return a.sections.some((s) => !s.submitted_at) || (isMock(a) && a.next_section !== null);
}

/** Куда вести «Continue»: в начатую секцию или на страницу полного экзамена */
export function continuePath(a: Attempt) {
  const open = a.sections.find((s) => !s.submitted_at);
  if (open) return `/${open.section_type}/${open.id}`;
  return `/mock/${a.id}`;
}

/** После сдачи секции: в полном экзамене — на его страницу (дальше следующая секция), иначе — к результату */
export async function afterSubmitPath(section: AvailableSection, sectionAttemptId: number) {
  const fallback = `/${section}/${sectionAttemptId}/result`;
  try {
    const attempt = (await listAttempts()).find((a) => a.sections.some((s) => s.id === sectionAttemptId));
    return attempt && isMock(attempt) ? `/mock/${attempt.id}` : fallback;
  } catch {
    return fallback;
  }
}
