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

/** Секции с вопросами (автопроверка) */
export type QuestionSection = Extract<SectionType, "reading" | "listening">;
/** Секции, которые уже можно проходить на сайте */
export type AvailableSection = QuestionSection | "writing" | "speaking";

export async function startSectionAttempt(testId: number, section: AvailableSection) {
  const { data: attempt } = await apiClient.post<Attempt>("/attempts", {
    test_id: testId,
    section_type: section,
  });
  const { data } = await apiClient.post<{ section_attempt_id: number }>(`/${section}/attempts/${attempt.id}/start`);
  return data;
}

/** Полный mock-экзамен: попытка без section_type, секции — по очереди */
export async function startFullMock(testId: number) {
  const { data } = await apiClient.post<Attempt>("/attempts", { test_id: testId });
  return data;
}

export async function getAttempt(attemptId: number) {
  const { data } = await apiClient.get<Attempt>(`/attempts/${attemptId}`);
  return data;
}

/** Начать (или продолжить) секцию попытки */
export async function startSection(attemptId: number, section: AvailableSection) {
  const { data } = await apiClient.post<{ section_attempt_id: number }>(`/${section}/attempts/${attemptId}/start`);
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

// ───────────────────────── Writing ─────────────────────────

export interface WritingTask {
  id: number;
  task_number: 1 | 2;
  prompt: string;
  image_url: string | null;
  min_words: number;
  recommended_min: number;
}

export interface WritingDraft {
  task_id: number;
  text: string;
  word_count: number;
}

export interface WritingContent {
  section_attempt_id: number;
  attempt_id: number;
  deadline: string;
  tasks: WritingTask[];
  responses: WritingDraft[];
}

export interface CriteriaScores {
  task_response: number; // Task Achievement (Task 1) / Task Response (Task 2)
  coherence_cohesion: number;
  lexical_resource: number;
  grammatical_range: number;
}

/** Комментарий учителя к фрагменту эссе: text.slice(start, end) === quote */
export interface InlineComment {
  start: number;
  end: number;
  quote: string;
  text: string;
}

export interface WritingAssessment extends CriteriaScores {
  band: string;
  feedback: string | null;
  comments: InlineComment[];
  grader_name: string | null;
  created_at: string;
}

export interface WritingTaskResult {
  task_id: number;
  task_number: 1 | 2;
  prompt: string;
  image_url: string | null;
  min_words: number;
  text: string;
  word_count: number;
  assessment: WritingAssessment | null;
}

export interface WritingResult {
  section_attempt_id: number;
  attempt_id: number;
  test_title: string;
  submitted_at: string | null;
  time_spent_sec: number | null;
  band_score: string | null;
  status: "pending" | "assessed";
  tasks: WritingTaskResult[];
}

export async function getWriting(sectionAttemptId: number) {
  const { data } = await apiClient.get<WritingContent>(`/writing/${sectionAttemptId}`);
  return data;
}

export async function saveWriting(sectionAttemptId: number, taskId: number, text: string) {
  const { data } = await apiClient.put<WritingDraft>(`/writing/${sectionAttemptId}/tasks/${taskId}`, { text });
  return data;
}

export async function submitWriting(sectionAttemptId: number) {
  const { data } = await apiClient.post<SectionAttemptShort>(`/writing/${sectionAttemptId}/submit`);
  return data;
}

export async function getWritingResult(sectionAttemptId: number) {
  const { data } = await apiClient.get<WritingResult>(`/writing/${sectionAttemptId}/result`);
  return data;
}

// ───────────────────────── Speaking ─────────────────────────

export interface SpeakingTask {
  id: number;
  part: 1 | 2 | 3;
  position: number;
  prompt: string; // Part 1/3 — вопрос, Part 2 — тема карточки
  cue_card_points: string[];
  prep_time_sec: number; // 0 — без подготовки
  speak_time_sec: number;
}

export interface SpeakingContent {
  section_attempt_id: number;
  attempt_id: number;
  deadline: string;
  tasks: SpeakingTask[]; // в порядке экзамена
  answered_task_ids: number[];
}

export interface SpeakingScores {
  fluency_coherence: number;
  lexical_resource: number;
  grammatical_range: number;
  pronunciation: number;
}

export interface SpeakingAssessment extends SpeakingScores {
  band: string;
  feedback: string | null;
  grader_name: string | null;
  created_at: string;
}

/** Вопрос с примерным ответом учителя — у учителя и в результате после сдачи */
export interface TeacherSpeakingTask extends SpeakingTask {
  sample_answer: string | null;
}

export interface SpeakingTaskResult extends TeacherSpeakingTask {
  response_id: number | null; // null — ответа нет
  duration_sec: number | null;
}

export interface SpeakingResult {
  section_attempt_id: number;
  attempt_id: number;
  test_title: string;
  submitted_at: string | null;
  time_spent_sec: number | null;
  band_score: string | null;
  status: "pending" | "assessed";
  tasks: SpeakingTaskResult[];
  assessment: SpeakingAssessment | null;
}

export async function getSpeaking(sectionAttemptId: number) {
  const { data } = await apiClient.get<SpeakingContent>(`/speaking/${sectionAttemptId}`);
  return data;
}

export async function uploadSpeakingAnswer(sectionAttemptId: number, taskId: number, audio: Blob, durationSec: number) {
  const form = new FormData();
  const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("file", audio, `answer.${extension}`);
  form.append("duration_sec", String(Math.round(durationSec)));
  await apiClient.post(`/speaking/${sectionAttemptId}/tasks/${taskId}`, form);
}

export async function submitSpeaking(sectionAttemptId: number) {
  const { data } = await apiClient.post<SectionAttemptShort>(`/speaking/${sectionAttemptId}/submit`);
  return data;
}

export async function getSpeakingResult(sectionAttemptId: number) {
  const { data } = await apiClient.get<SpeakingResult>(`/speaking/${sectionAttemptId}/result`);
  return data;
}

/** Запись ответа — с токеном, поэтому не ссылкой, а файлом в памяти браузера */
export async function getRecording(responseId: number) {
  const { data } = await apiClient.get<Blob>(`/speaking/recordings/${responseId}`, { responseType: "blob" });
  return data;
}
