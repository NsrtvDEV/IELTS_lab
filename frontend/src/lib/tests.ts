import type { TeacherTest } from "../api/teacher";

/** Содержимое нельзя менять у опубликованного теста и у теста, который уже проходили */
export function isLocked(test: TeacherTest) {
  return test.is_published || test.has_attempts;
}
