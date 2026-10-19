import { apiClient } from "./client";

export type NotificationKind = "assessed" | "auto_submitted" | "test_published" | "review_submitted" | "review_waiting";

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  text: string;
  link: string | null; // путь на сайте
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  unread: number;
  items: AppNotification[];
}

export async function listNotifications() {
  const { data } = await apiClient.get<NotificationList>("/notifications");
  return data;
}

export async function markNotificationRead(id: number) {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await apiClient.post("/notifications/read-all");
}
