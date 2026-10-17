import { apiClient } from "./client";
import type { QuestionType, SectionType } from "./teacher";

export interface StudentTest {
  id: number;
  title: string;
  sections: { type: SectionType; duration_min: number }[];
  completed_sections: SectionType[];
}

export type AttemptStatus = "in_progress" | "pending_review" | "finished" | "abandoned";

export interface SectionAttemptShort {
  id: number;
  section_type: SectionType;
  started_at: string;
  deadline: string;
  submitted_at: string | null;
  raw_score: number | null;
  band_score: string | null;
}

export interface Attempt {
  id: number;
  test_id: number;
  test_title: string;
  section_type: SectionType | null;
  status: AttemptStatus;
  started_at: string;
  finished_at: string | null;
  overall_band: string | null;
  sections: SectionAttemptShort[];
  next_section: SectionType | null;
}

export interface Option {
  id: number;
  label: string;
  text: string;
}

export interface Question {
  id: number;
  number: number;
  text: string | null;
  answers_required: number;
  meta: Record<string, unknown> | null;
  options: Option[];
}

export interface QuestionGroup {
  id: number;
  passage_id: number | null;
  type: QuestionType;
  instruction: string;
  word_limit: number | null;
  allow_number: boolean;
  image_url: string | null;
  meta: Record<string, unknown> | null;
  options: Option[];
  questions: Question[];
}

export interface Passage {
  id: number;
  title: string | null;
  text: string | null;
  audio_url: string | null;
  audio_duration_sec?: number | null;
  position: number;
}

export interface SavedAnswer {
  question_id: number;
  answer_text: string | null;
  option_ids: number[];
}

export interface SectionContent {
  section_attempt_id: number;
  attempt_id: number;
  section_type: SectionType;
  deadline: string;
  passages: Passage[];
  question_groups: QuestionGroup[];
  answers: SavedAnswer[];
  playback: PlaybackState | null;
}

/** Listening: докуда дослушана запись (сервер принимает только движение вперёд) */
export interface PlaybackState {
  part: number;
  position: number;
  finished: boolean;
}

export async function savePlayback(sectionAttemptId: number, state: PlaybackState) {
  const { data } = await apiClient.put<PlaybackState>(`/listening/${sectionAttemptId}/playback`, state);
  return data;
}

export interface QuestionResult {
  question_id: number;
  number: number;
  type: QuestionType;
  passage_id: number | null;
  your_answer: string | null;
  correct_answers: string[];
  earned: number;
  points: number;
}

export interface SectionResult {
  section_attempt_id: number;
  attempt_id: number;
  test_title: string;
  section_type: SectionType;
  submitted_at: string | null;
  raw_score: number | null;
  max_score: number;
  correct_count: number;
  question_count: number;
  band_score: string | null;
  time_spent_sec: number | null;
  questions: QuestionResult[];
  passages: Passage[]; // Reading — тексты, Listening — записи и транскрипты (после сдачи)
}

export async function listPublishedTests() {
  const { data } = await apiClient.get<StudentTest[]>("/tests");
  return data;
}

export async function listAttempts() {
  const { data } = await apiClient.get<Attempt[]>("/attempts");
  return data;
}

/** Секции, которые уже можно проходить на сайте */
export type QuestionSection = Extract<SectionType, "reading" | "listening">;

export async function startSectionAttempt(testId: number, section: QuestionSection) {
  const { data: attempt } = await apiClient.post<Attempt>("/attempts", {
    test_id: testId,
    section_type: section,
  });
  const { data } = await apiClient.post<SectionContent>(`/${section}/attempts/${attempt.id}/start`);
  return data;
}

export async function getSectionContent(section: QuestionSection, sectionAttemptId: number) {
  const { data } = await apiClient.get<SectionContent>(`/${section}/${sectionAttemptId}`);
  return data;
}

export async function saveSectionAnswers(section: QuestionSection, sectionAttemptId: number, answers: SavedAnswer[]) {
  await apiClient.put(`/${section}/${sectionAttemptId}/answers`, { answers });
}

export async function submitSection(section: QuestionSection, sectionAttemptId: number) {
  const { data } = await apiClient.post<SectionAttemptShort>(`/${section}/${sectionAttemptId}/submit`);
  return data;
}

export async function abandonAttempt(attemptId: number) {
  await apiClient.post(`/attempts/${attemptId}/abandon`);
}

export interface ProgressPoint {
  attempt_id: number;
  section_attempt_id: number | null;
  test_title: string;
  band: string;
  date: string;
}

export interface Progress {
  sections: Partial<Record<SectionType, ProgressPoint[]>>;
  overall: ProgressPoint[];
  question_types: { type: QuestionType; total: number; wrong: number }[];
}

export async function getProgress() {
  const { data } = await apiClient.get<Progress>("/users/me/progress");
  return data;
}

export async function getSectionResult(section: QuestionSection, sectionAttemptId: number) {
  const { data } = await apiClient.get<SectionResult>(`/${section}/${sectionAttemptId}/result`);
  return data;
}
