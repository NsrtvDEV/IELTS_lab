import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "../api/types";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[]; // без roles — любой вошедший пользователь
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-muted">Loading…</div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
