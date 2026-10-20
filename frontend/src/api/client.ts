import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { t } from "../i18n";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

// картинки и файлы раздаёт тот же сервер, что и API, но не под /api/v1;
// адрес может быть относительным ("/api/v1") — тогда API на том же сайте
const SERVER_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${SERVER_ORIGIN}${path}`;
}

export const ACCESS_TOKEN_KEY = "bandup_access_token";
export const REFRESH_TOKEN_KEY = "bandup_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

// Бэкенд ротирует refresh token: каждый /auth/refresh выдаёт новую пару,
// а старый refresh token становится недействительным — сохраняем оба.
async function refreshTokens(): Promise<string> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  tokenStorage.set(data.access_token, data.refresh_token);
  return data.access_token as string;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/")
    ) {
      originalRequest._retry = true;
      try {
        // несколько запросов получили 401 одновременно — обновляем токен один раз
        if (!refreshPromise) {
          refreshPromise = refreshTokens().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccessToken = await refreshPromise;
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      } catch {
        tokenStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return t("Server is unavailable. Please try again later.");
    const detail = error.response.data?.detail;
    if (typeof detail === "string") return t(detail);
    if (Array.isArray(detail) && detail[0]?.msg) return t(String(detail[0].msg).replace(/^Value error, /, ""));
    return error.message;
  }
  return t("Something went wrong");
}
