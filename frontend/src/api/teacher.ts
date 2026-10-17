import { apiClient } from "./client";
import type {
  CriteriaScores,
  SectionResult,
  SpeakingResult,
  SpeakingScores,
  TeacherSpeakingTask,
  WritingResult,
  WritingTask,
} from "./student";

export type SectionType = "listening" | "reading" | "writing" | "speaking";

export type QuestionType =
  | "mcq"
  | "mcq_multi"
  | "tfng"
  | "ynng"
  | "matching_headings"
  | "matching_info"
  | "matching_features"
  | "matching_sentence_endings"
  | "sentence_completion"
  | "summary_completion"
  | "note_completion"
  | "form_completion"
  | "table_completion"
  | "flow_chart_completion"
  | "gap_fill"
  | "short_answer"
  | "diagram_label"
  | "map_label";

export interface TeacherSection {
  id: number;
  type: SectionType;
  duration_min: number;
  question_count: number;
}

export interface TeacherTest {
  id: number;
  title: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  sections: TeacherSection[];
  has_attempts: boolean;
  problems: string[];
}

export interface TeacherPassage {
  id: number;
  title: string | null;
  text: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  position: number;
}

export interface TeacherOption {
  id: number;
  label: string;
  text: string;
}

export interface TeacherQuestion {
  id: number;
  number: number;
  text: string | null;
  answers_required: number;
  points: number;
  meta: Record<string, unknown> | null;
  options: TeacherOption[];
  correct_options: string[];
  correct_texts: string[];
}

export interface TeacherQuestionGroup {
  id: number;
  passage_id: number | null;
  type: QuestionType;
  instruction: string;
  word_limit: number | null;
  allow_number: boolean;
  position: number;
  image_url: string | null;
  meta: Record<string, unknown> | null;
  options: TeacherOption[];
  questions: TeacherQuestion[];
}

export interface TeacherSectionContent {
  id: number;
  test_id: number;
  type: SectionType;
  duration_min: number;
  passages: TeacherPassage[];
  question_groups: TeacherQuestionGroup[];
  question_numbers: number[];
  writing_tasks: WritingTask[];
  speaking_tasks: TeacherSpeakingTask[];
}

export interface OptionInput {
  label: string;
  text: string;
}

export interface QuestionInput {
  number: number;
  text: string | null;
  answers_required: number;
  options: OptionInput[];
  correct_options: string[];
  correct_texts: string[];
}

export interface QuestionGroupInput {
  passage_id: number | null;
  type: QuestionType;
  instruction: string;
  word_limit: number | null;
  allow_number: boolean;
  position: number;
  image_url: string | null;
  options: OptionInput[];
  questions: QuestionInput[];
  meta: Record<string, unknown> | null; // { template: "Name: {1}" } — раскладка формы/таблицы
}

export interface PassageInput {
  title: string | null;
  text: string | null;
  audio_url: string | null;
  position: number;
}

// ───────────────────────── Tests ─────────────────────────

export async function listTests() {
  const { data } = await apiClient.get<TeacherTest[]>("/teacher/tests");
  return data;
}

export async function getTest(id: number) {
  const { data } = await apiClient.get<TeacherTest>(`/teacher/tests/${id}`);
  return data;
}

export async function createTest(title: string) {
  const { data } = await apiClient.post<TeacherTest>("/teacher/tests", { title });
  return data;
}

export async function renameTest(id: number, title: string) {
  const { data } = await apiClient.patch<TeacherTest>(`/teacher/tests/${id}`, { title });
  return data;
}

export async function deleteTest(id: number) {
  await apiClient.delete(`/teacher/tests/${id}`);
}

export async function publishTest(id: number) {
  const { data } = await apiClient.post<TeacherTest>(`/teacher/tests/${id}/publish`);
  return data;
}

export async function unpublishTest(id: number) {
  const { data } = await apiClient.post<TeacherTest>(`/teacher/tests/${id}/unpublish`);
  return data;
}

// ───────────────────────── Sections ─────────────────────────

export async function getSection(id: number) {
  const { data } = await apiClient.get<TeacherSectionContent>(`/teacher/sections/${id}`);
  return data;
}

export async function updateSectionDuration(id: number, duration_min: number) {
  const { data } = await apiClient.patch<TeacherSectionContent>(`/teacher/sections/${id}`, {
    duration_min,
  });
  return data;
}

export async function createPassage(sectionId: number, input: PassageInput) {
  const { data } = await apiClient.post<TeacherPassage>(
    `/teacher/sections/${sectionId}/passages`,
    input
  );
  return data;
}

export async function updatePassage(id: number, input: Partial<PassageInput>) {
  const { data } = await apiClient.patch<TeacherPassage>(`/teacher/passages/${id}`, input);
  return data;
}

export async function deletePassage(id: number) {
  await apiClient.delete(`/teacher/passages/${id}`);
}

export async function createQuestionGroup(sectionId: number, input: QuestionGroupInput) {
  const { data } = await apiClient.post<TeacherQuestionGroup>(
    `/teacher/sections/${sectionId}/question-groups`,
    input
  );
  return data;
}

export async function replaceQuestionGroup(id: number, input: QuestionGroupInput) {
  const { data } = await apiClient.put<TeacherQuestionGroup>(
    `/teacher/question-groups/${id}`,
    input
  );
  return data;
}

export async function deleteQuestionGroup(id: number) {
  await apiClient.delete(`/teacher/question-groups/${id}`);
}

export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/teacher/uploads/images", form);
  return data.url;
}

export async function uploadAudio(file: File, onProgress?: (percent: number) => void) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/teacher/uploads/audio", form, {
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  });
  return data.url;
}

// ───────────────────────── Dashboard ─────────────────────────

export interface Stat {
  value: number | string | null; // band приходит строкой ("6.5")
  change: number | null; // счётчики — %, band — баллы; null — не с чем сравнить
}

export interface StudentProgress {
  id: number;
  name: string;
  email: string;
  overall_band: string;
  change: string | null;
  last_activity: string;
  last_activity_at: string;
}

export interface SectionPerformance {
  section_type: SectionType;
  band: string | null;
  attempts: number;
}

export interface Activity {
  kind: "joined" | "section_completed" | "mock_completed";
  student: string;
  text: string;
  at: string;
}

export interface TestSummary {
  id: number;
  title: string;
  is_published: boolean;
  problems: number;
  questions: number;
}

export interface TeacherDashboard {
  stats: {
    total_students: Stat;
    published_tests: Stat;
    draft_tests: number;
    tests_completed: Stat;
    average_band: Stat;
  };
  students: StudentProgress[];
  performance: { overall_band: string | null; sections: SectionPerformance[] };
  activities: Activity[];
  tests: TestSummary[];
}

export async function getDashboard() {
  const { data } = await apiClient.get<TeacherDashboard>("/teacher/dashboard");
  return data;
}

// ───────────────────────── Students ─────────────────────────

export interface StudentSummary {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  joined_at: string;
  sections_completed: number;
  bands: Partial<Record<SectionType, string>>;
  overall_band: string | null;
  last_activity_at: string | null;
}

export interface HistoryItem {
  section_attempt_id: number;
  attempt_id: number;
  test_title: string;
  section_type: SectionType;
  mode: "section" | "mock";
  status: "in_progress" | "pending_review" | "finished" | "abandoned";
  started_at: string;
  submitted_at: string | null;
  raw_score: number | null;
  band_score: string | null;
}

export interface StudentDetail extends StudentSummary {
  native_language: string | null;
  history: HistoryItem[];
}

export async function listStudents(q?: string) {
  const { data } = await apiClient.get<StudentSummary[]>("/teacher/students", { params: q ? { q } : {} });
  return data;
}

export async function getStudent(id: number) {
  const { data } = await apiClient.get<StudentDetail>(`/teacher/students/${id}`);
  return data;
}

export async function getStudentResult(studentId: number, sectionAttemptId: number) {
  const { data } = await apiClient.get<SectionResult>(
    `/teacher/students/${studentId}/results/${sectionAttemptId}`
  );
  return data;
}

// ───────────────────────── Writing tasks ─────────────────────────

export interface WritingTaskInput {
  prompt: string;
  image_url: string | null;
  min_words: number;
  recommended_min: number;
}

export async function createWritingTask(sectionId: number, input: WritingTaskInput & { task_number: 1 | 2 }) {
  const { data } = await apiClient.post<WritingTask>(
    `/teacher/sections/${sectionId}/writing-tasks`,
    input
  );
  return data;
}

export async function updateWritingTask(taskId: number, input: Partial<WritingTaskInput>) {
  const { data } = await apiClient.patch<WritingTask>(`/teacher/writing-tasks/${taskId}`, input);
  return data;
}

export async function deleteWritingTask(taskId: number) {
  await apiClient.delete(`/teacher/writing-tasks/${taskId}`);
}

// ───────────────────────── Speaking questions ─────────────────────────

export interface SpeakingTaskInput {
  part: 1 | 2 | 3;
  prompt: string;
  cue_card_points: string[];
  prep_time_sec: number | null; // null — по умолчанию
  speak_time_sec: number | null;
  sample_answer: string;
  position?: number;
}

export async function createSpeakingTask(sectionId: number, input: SpeakingTaskInput) {
  const { data } = await apiClient.post<TeacherSpeakingTask>(`/teacher/sections/${sectionId}/speaking-tasks`, input);
  return data;
}

export async function updateSpeakingTask(taskId: number, input: Partial<Omit<SpeakingTaskInput, "part">>) {
  const { data } = await apiClient.patch<TeacherSpeakingTask>(`/teacher/speaking-tasks/${taskId}`, input);
  return data;
}

export async function deleteSpeakingTask(taskId: number) {
  await apiClient.delete(`/teacher/speaking-tasks/${taskId}`);
}

// ───────────────────────── Review ─────────────────────────

export interface ReviewItem {
  section_attempt_id: number;
  section_type: "writing" | "speaking";
  student_id: number;
  student_name: string;
  student_email: string;
  test_title: string;
  mode: "section" | "mock";
  submitted_at: string;
  word_counts: number[]; // Writing: Task 1, Task 2
  answered: number | null; // Speaking: вопросов с ответом
  questions: number | null; // Speaking: вопросов всего
  band_score: string | null;
}

export interface ReviewDetail extends WritingResult {
  student_id: number;
  student_name: string;
  student_email: string;
}

export interface TaskAssessmentInput extends CriteriaScores {
  task_id: number;
  feedback: string | null;
}

export async function listReview(status: "pending" | "assessed" | "all" = "pending") {
  const { data } = await apiClient.get<ReviewItem[]>("/teacher/review", { params: { status } });
  return data;
}

export async function getReviewWriting(sectionAttemptId: number) {
  const { data } = await apiClient.get<ReviewDetail>(`/teacher/review/writing/${sectionAttemptId}`);
  return data;
}

export async function assessWriting(sectionAttemptId: number, tasks: TaskAssessmentInput[]) {
  const { data } = await apiClient.post<ReviewDetail>(`/teacher/review/writing/${sectionAttemptId}`, { tasks });
  return data;
}

export interface SpeakingReviewDetail extends SpeakingResult {
  student_id: number;
  student_name: string;
  student_email: string;
}

export async function getReviewSpeaking(sectionAttemptId: number) {
  const { data } = await apiClient.get<SpeakingReviewDetail>(`/teacher/review/speaking/${sectionAttemptId}`);
  return data;
}

export async function assessSpeaking(sectionAttemptId: number, scores: SpeakingScores & { feedback: string | null }) {
  const { data } = await apiClient.post<SpeakingReviewDetail>(`/teacher/review/speaking/${sectionAttemptId}`, scores);
  return data;
}
