import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { apiErrorMessage } from "../api/client";
import {
  AuthCard,
  AuthSwitchLink,
  FormAlert,
  GoogleButton,
  PasswordField,
  SecurityNote,
  SubmitButton,
  TextField,
} from "../components/AuthForm";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Восстановление пароля и вход через Google на бэкенде ещё не реализованы
  function comingSoon(feature: string) {
    setError(null);
    setNotice(`${feature} is coming soon.`);
  }

  return (
    <AuthLayout>
      <AuthSwitchLink question="Don't have an account?" to="/register" label="Sign up" />

      <AuthCard title="Welcome back" subtitle="Log in to continue your IELTS journey">
        <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
          <TextField
            id="email"
            label="Email address"
            icon={Mail}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <div>
            <PasswordField
              id="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => comingSoon("Password recovery")}
                className="text-sm font-medium text-brand-500 hover:text-brand-700"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <FormAlert error={error} notice={notice} />
          <SubmitButton loading={submitting}>Log in</SubmitButton>
        </form>

        <GoogleButton onClick={() => comingSoon("Sign in with Google")} />
        <SecurityNote />
      </AuthCard>
    </AuthLayout>
  );
}
