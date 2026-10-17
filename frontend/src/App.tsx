import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TeacherLayout } from "./components/TeacherLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TEACHER_ROLES } from "./lib/config";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SectionEditorPage } from "./pages/teacher/SectionEditorPage";
import { TestDetailPage } from "./pages/teacher/TestDetailPage";
import { TestsPage } from "./pages/teacher/TestsPage";

function Teacher({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute roles={TEACHER_ROLES}>
      <TeacherLayout>{children}</TeacherLayout>
    </ProtectedRoute>
  );
}

/** Главная: учителя и админы сразу попадают в кабинет учителя */
function Home() {
  const { user } = useAuth();
  if (user && TEACHER_ROLES.includes(user.role)) return <Navigate to="/teacher/tests" replace />;
  return <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/teacher" element={<Navigate to="/teacher/tests" replace />} />
        <Route path="/teacher/tests" element={<Teacher><TestsPage /></Teacher>} />
        <Route path="/teacher/tests/:testId" element={<Teacher><TestDetailPage /></Teacher>} />
        <Route path="/teacher/sections/:sectionId" element={<Teacher><SectionEditorPage /></Teacher>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
