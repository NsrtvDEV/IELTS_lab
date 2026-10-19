import type { UserRole } from "../api/types";

// порядок и цвета ролей фиксированы (проверены валидатором палитры; у каждой роли есть подпись с числом)
export const ROLE_ORDER: UserRole[] = ["student", "teacher", "admin"];
export const ROLE_COLORS: Record<UserRole, string> = { student: "#2f6bff", teacher: "#10b981", admin: "#8b5cf6" };
export const ROLE_LABELS: Record<UserRole, string> = { student: "Student", teacher: "Teacher", admin: "Admin" };
export const ROLE_PLURAL: Record<UserRole, string> = { student: "Students", teacher: "Teachers", admin: "Admins" };
