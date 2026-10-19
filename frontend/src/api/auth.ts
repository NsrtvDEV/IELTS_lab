import { apiClient, tokenStorage } from "./client";
import type { TokenResponse, User } from "./types";

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", { email, password });
  return data;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export async function register(data: RegisterData) {
  await apiClient.post("/auth/register", data);
}

export async function logout(refreshToken: string) {
  await apiClient.post("/auth/logout", { refresh_token: refreshToken });
}

export async function fetchMe() {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
}

export interface ProfileInput {
  first_name?: string;
  last_name?: string;
  native_language?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
}

export async function updateProfile(input: ProfileInput) {
  const { data } = await apiClient.patch<User>("/users/me", input);
  return data;
}

/** Смена пароля: сервер выходит на других устройствах и выдаёт этому новую пару токенов */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await apiClient.post<TokenResponse>("/users/me/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  tokenStorage.set(data.access_token, data.refresh_token);
}

/** Фото профиля: PNG, JPG или WEBP до 2 МБ */
export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<User>("/users/me/avatar", form);
  return data;
}

export async function deleteAvatar() {
  const { data } = await apiClient.delete<User>("/users/me/avatar");
  return data;
}
