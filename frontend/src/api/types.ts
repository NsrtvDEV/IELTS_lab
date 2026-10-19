export type UserRole = "student" | "teacher" | "admin";

export interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  native_language: string | null;
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  profile: UserProfile | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
