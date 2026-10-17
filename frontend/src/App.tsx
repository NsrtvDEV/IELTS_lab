import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TeacherLayout } from "./components/TeacherLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TEACHER_ROLES } from "./lib/config";
import { StudentLayout } from "./components/StudentLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProgressPage } from "./pages/student/ProgressPage";
import { SectionAttemptPage } from "./pages/student/SectionAttemptPage";
import { SectionResultPage } from "./pages/student/SectionResultPage";
import { SpeakingPage } from "./pages/student/SpeakingPage";
import { SpeakingResultPage } from "./pages/student/SpeakingResultPage";
import { WritingPage } from "./pages/student/WritingPage";
import { WritingResultPage } from "./pages/student/WritingResultPage";
import { StudentHomePage } from "./pages/student/StudentHomePage";
import { DashboardPage } from "./pages/teacher/DashboardPage";
import { SectionEditorPage } from "./pages/teacher/SectionEditorPage";
import { ReviewQueuePage } from "./pages/teacher/ReviewQueuePage";
import { ReviewSpeakingPage } from "./pages/teacher/ReviewSpeakingPage";
import { ReviewWritingPage } from "./pages/teacher/ReviewWritingPage";
import { SectionPreviewPage } from "./pages/teacher/SectionPreviewPage";
import { StudentDetailPage, StudentResultPage } from "./pages/teacher/StudentDetailPage";
import { StudentsPage } from "./pages/teacher/StudentsPage";
import { TestDetailPage } from "./pages/teacher/TestDetailPage";
import { TestsPage } from "./pages/teacher/TestsPage";

function Teacher({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute roles={TEACHER_ROLES}>
      <TeacherLayout>{children}</TeacherLayout>
    </ProtectedRoute>
  );
}

/** Главная: гость видит лендинг, учителя и админы сразу попадают в кабинет учителя */
function Home() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-ink-muted">Loading…</div>;
  }
  if (!user) return <LandingPage />;
  if (TEACHER_ROLES.includes(user.role)) return <Navigate to="/teacher" replace />;
  return (
    <StudentLayout>
      <StudentHomePage />
    </StudentLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Home />} />
        {/* прохождение секции — на весь экран, без шапки */}
        {(["reading", "listening"] as const).map((section) => [
          <Route
            key={section}
            path={`/${section}/:sectionAttemptId`}
            element={<ProtectedRoute><SectionAttemptPage key={section} section={section} /></ProtectedRoute>}
          />,
          <Route
            key={`${section}-result`}
            path={`/${section}/:sectionAttemptId/result`}
            element={<ProtectedRoute><StudentLayout><SectionResultPage section={section} /></StudentLayout></ProtectedRoute>}
          />,
        ])}
        <Route path="/writing/:sectionAttemptId" element={<ProtectedRoute><WritingPage /></ProtectedRoute>} />
        <Route
          path="/writing/:sectionAttemptId/result"
          element={<ProtectedRoute><StudentLayout><WritingResultPage /></StudentLayout></ProtectedRoute>}
        />
        <Route path="/speaking/:sectionAttemptId" element={<ProtectedRoute><SpeakingPage /></ProtectedRoute>} />
        <Route
          path="/speaking/:sectionAttemptId/result"
          element={<ProtectedRoute><StudentLayout><SpeakingResultPage /></StudentLayout></ProtectedRoute>}
        />
        <Route path="/progress" element={<ProtectedRoute><StudentLayout><ProgressPage /></StudentLayout></ProtectedRoute>} />
        <Route path="/teacher" element={<Teacher><DashboardPage /></Teacher>} />
        <Route path="/teacher/tests" element={<Teacher><TestsPage /></Teacher>} />
        <Route path="/teacher/tests/:testId" element={<Teacher><TestDetailPage /></Teacher>} />
        <Route path="/teacher/sections/:sectionId" element={<Teacher><SectionEditorPage /></Teacher>} />
        <Route
          path="/teacher/sections/:sectionId/preview"
          element={<ProtectedRoute roles={TEACHER_ROLES}><SectionPreviewPage /></ProtectedRoute>}
        />
        <Route path="/teacher/review" element={<Teacher><ReviewQueuePage /></Teacher>} />
        <Route path="/teacher/review/writing/:sectionAttemptId" element={<Teacher><ReviewWritingPage /></Teacher>} />
        <Route path="/teacher/review/speaking/:sectionAttemptId" element={<Teacher><ReviewSpeakingPage /></Teacher>} />
        <Route path="/teacher/students" element={<Teacher><StudentsPage /></Teacher>} />
        <Route path="/teacher/students/:studentId" element={<Teacher><StudentDetailPage /></Teacher>} />
        <Route path="/teacher/students/:studentId/results/:sectionAttemptId" element={<Teacher><StudentResultPage /></Teacher>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
