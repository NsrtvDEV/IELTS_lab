// Сводка ученика для дашборда — считается из попыток (GET /attempts) и тестов (GET /tests)
import type { Attempt, StudentTest } from "../api/student";
import type { SectionType } from "../api/teacher";
import { roundBand } from "./writing";

export const SECTIONS: SectionType[] = ["reading", "listening", "writing", "speaking"];

export interface SectionResultItem {
  type: SectionType;
  sectionAttemptId: number;
  attemptId: number;
  testId: number;
  testTitle: string;
  mode: "section" | "mock";
  band: number | null; // null — Writing/Speaking ещё не проверены
  raw: number | null; // Listening/Reading: правильных ответов из 40
  date: string; // когда сдана секция
}

/** Все сданные секции, кроме прерванных попыток, — от старых к новым */
export function sectionResults(attempts: Attempt[]): SectionResultItem[] {
  return attempts
    .filter((a) => a.status !== "abandoned")
    .flatMap((a) =>
      a.sections
        .filter((s) => s.submitted_at)
        .map((s) => ({
          type: s.section_type,
          sectionAttemptId: s.id,
          attemptId: a.id,
          testId: a.test_id,
          testTitle: a.test_title,
          mode: a.section_type ? ("section" as const) : ("mock" as const),
          band: s.band_score === null ? null : Number(s.band_score),
          raw: s.raw_score,
          date: s.submitted_at!,
        }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SectionSummary {
  band: number | null; // последний результат
  change: number | null; // относительно предыдущего результата этой секции
  count: number; // сколько раз сдана (с оценкой)
}

export function sectionSummaries(results: SectionResultItem[]): Record<SectionType, SectionSummary> {
  const summary = {} as Record<SectionType, SectionSummary>;
  for (const type of SECTIONS) {
    const bands = results.filter((r) => r.type === type && r.band !== null).map((r) => r.band!);
    const last = bands.at(-1) ?? null;
    const prev = bands.at(-2) ?? null;
    summary[type] = { band: last, change: last !== null && prev !== null ? last - prev : null, count: bands.length };
  }
  return summary;
}

/** Общий band: среднее последних результатов по секциям (как у учителя на дашборде).
 *  change — относительно того, каким он был до последнего результата. */
export function overallBand(results: SectionResultItem[]): { band: number | null; change: number | null } {
  const graded = results.filter((r) => r.band !== null);
  const at = (items: SectionResultItem[]) => {
    const latest = new Map<SectionType, number>();
    for (const r of items) latest.set(r.type, r.band!);
    return latest.size ? roundBand([...latest.values()].reduce((a, b) => a + b, 0) / latest.size) : null;
  };
  const band = at(graded);
  const before = graded.length > 1 ? at(graded.slice(0, -1)) : null;
  return { band, change: band !== null && before !== null ? band - before : null };
}

export interface RecentTest {
  key: string;
  attemptId: number;
  title: string;
  mode: "section" | "mock";
  date: string;
  sections: SectionResultItem[];
  overall: number | null; // полный экзамен
}

/** Последние пройденные тесты: полный экзамен — одной строкой, секция — своей */
export function recentTests(attempts: Attempt[], results: SectionResultItem[], limit = 3): RecentTest[] {
  const byAttempt = new Map<number, SectionResultItem[]>();
  for (const r of results) byAttempt.set(r.attemptId, [...(byAttempt.get(r.attemptId) ?? []), r]);
  const items: RecentTest[] = [];
  for (const a of attempts) {
    const rs = byAttempt.get(a.id);
    if (!rs) continue;
    if (a.section_type === null) {
      items.push({
        key: `mock-${a.id}`,
        attemptId: a.id,
        title: a.test_title,
        mode: "mock",
        date: rs.at(-1)!.date,
        sections: rs,
        overall: a.overall_band === null ? null : Number(a.overall_band),
      });
    } else {
      for (const r of rs)
        items.push({ key: `s-${r.sectionAttemptId}`, attemptId: a.id, title: a.test_title, mode: "section", date: r.date, sections: [r], overall: null });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** Секции, сданные сегодня (по времени браузера) — дневная цель: все четыре */
export function practisedToday(results: SectionResultItem[], now = new Date()): Set<SectionType> {
  const today = now.toDateString();
  return new Set(results.filter((r) => new Date(r.date).toDateString() === today).map((r) => r.type));
}

/** Самая слабая секция среди пройденных */
export function weakestSection(summary: Record<SectionType, SectionSummary>): SectionType | null {
  const taken = SECTIONS.filter((t) => summary[t].band !== null);
  if (!taken.length) return null;
  return taken.reduce((a, b) => (summary[b].band! < summary[a].band! ? b : a));
}

export interface Recommendation {
  type: SectionType;
  test: StudentTest;
  minutes: number;
  reason: "new" | "weak";
}

/** Что пройти дальше: сначала непройденные секции, потом слабые; тест, где секция ещё не сдана */
export function recommendations(
  tests: StudentTest[],
  summary: Record<SectionType, SectionSummary>,
  limit = 3
): Recommendation[] {
  const order = [...SECTIONS].sort((a, b) => (summary[a].band ?? -1) - (summary[b].band ?? -1));
  const items: Recommendation[] = [];
  for (const type of order) {
    const test = tests.find((t) => !t.completed_sections.includes(type)) ?? tests[0];
    const section = test?.sections.find((s) => s.type === type);
    if (!test || !section) continue;
    items.push({ type, test, minutes: section.duration_min, reason: summary[type].band === null ? "new" : "weak" });
    if (items.length === limit) break;
  }
  return items;
}

export function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;
}
