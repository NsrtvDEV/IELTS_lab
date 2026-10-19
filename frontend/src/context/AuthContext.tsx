import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type RegisterData,
} from "../api/auth";
import { tokenStorage } from "../api/client";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void; // после правки профиля
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (tokenStorage.getAccess()) {
        try {
          setUser(await fetchMe());
        } catch {
          tokenStorage.clear();
        }
      }
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const { access_token, refresh_token } = await apiLogin(email, password);
    tokenStorage.set(access_token, refresh_token);
    setUser(await fetchMe());
  }

  // после регистрации сразу входим — второй раз вводить пароль не нужно
  async function register(data: RegisterData) {
    await apiRegister(data);
    await login(data.email, data.password);
  }

  async function logout() {
    const refreshToken = tokenStorage.getRefresh();
    tokenStorage.clear();
    setUser(null);
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // токен мог уже истечь — не мешаем выходу из аккаунта
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
