import type { UserRole } from "../api/types";

// Django-админка — там пока добавляются задания Writing/Speaking и роли пользователей
export const DJANGO_ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? "http://127.0.0.1:8002/admin/";

export const TEACHER_ROLES: UserRole[] = ["teacher", "admin"];
