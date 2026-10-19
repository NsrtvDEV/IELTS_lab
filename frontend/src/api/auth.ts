import { apiClient } from "./client";
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
  first_name: string;
  last_name: string;
  native_language: string | null;
}

export async function updateProfile(input: ProfileInput) {
  const { data } = await apiClient.patch<User>("/users/me", input);
  return data;
}
