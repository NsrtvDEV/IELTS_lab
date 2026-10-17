import { apiClient } from "./client";

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
  const { data } = await apiClient.get<import("./student").SectionResult>(
    `/teacher/students/${studentId}/results/${sectionAttemptId}`
  );
  return data;
}
