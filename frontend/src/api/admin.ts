import { apiClient } from "./client";
import type { SectionType, Stat } from "./teacher";
import type { UserRole } from "./types";

export interface AdminActivity {
  kind: "user_joined" | "section_completed" | "test_created";
  at: string;
  user_name: string | null;
  avatar_url: string | null;
  section: SectionType | null;
  band: string | null;
  test_title: string | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  joined_at: string;
}

export interface AdminDashboard {
  total_users: Stat; // изменение — за неделю, %
  total_teachers: Stat;
  total_tests: Stat;
  average_band: Stat; // изменение — за месяц, в баллах
  roles: { role: UserRole; count: number }[];
  blocked_users: number;
  activity: AdminActivity[];
  top_tests: { id: number; title: string; average_band: string; attempts: number }[];
  skills: { section: SectionType; attempts: number }[];
  recent_users: AdminUser[];
}

export interface GrowthPoint {
  date: string; // YYYY-MM-DD
  users: number;
}

export async function getAdminDashboard() {
  const { data } = await apiClient.get<AdminDashboard>("/admin/dashboard");
  return data;
}

export async function getUserGrowth(days: number) {
  const { data } = await apiClient.get<GrowthPoint[]>("/admin/growth", { params: { days } });
  return data;
}

export async function listUsers(params: { q?: string; role?: UserRole; blocked?: boolean }) {
  const { data } = await apiClient.get<AdminUser[]>("/admin/users", { params });
  return data;
}

export async function updateUser(id: number, changes: { role?: UserRole; is_active?: boolean }) {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}`, changes);
  return data;
}
