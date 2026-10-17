import type { UserRole } from "../api/types";

// Django-админка — там пока добавляются задания Writing/Speaking и роли пользователей
export const DJANGO_ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? "http://127.0.0.1:8002/admin/";

export const TEACHER_ROLES: UserRole[] = ["teacher", "admin"];

/** Telegram для связи (лендинг): в .env можно писать "@username" или "https://t.me/username".
 *  Пусто — кнопки Telegram не показываются. */
function telegramUrl(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  return `https://t.me/${v.replace(/^@/, "").replace(/^t\.me\//, "")}`;
}

export const TELEGRAM_URL = telegramUrl(import.meta.env.VITE_TELEGRAM_URL);
