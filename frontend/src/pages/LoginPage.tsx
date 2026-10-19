import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { apiErrorMessage } from "../api/client";
import {
  AuthCard,
  AuthSwitchLink,
  FormAlert,
  PasswordField,
  SecurityNote,
  SubmitButton,
  TextField,
} from "../components/AuthForm";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n";

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
      setError(t("Enter your email and password."));
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

  return (
    <AuthLayout>
      <AuthSwitchLink question={t("Don't have an account?")} to="/register" label={t("Sign up")} />

      <AuthCard title={t("Welcome back")} subtitle={t("Log in to continue your IELTS journey")}>
        <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
          <TextField
            id="email"
            label={t("Email address")}
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
              label={t("Password")}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Enter your password")}
            />
            <div className="mt-3 text-right">
              <Link
                to={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : "/forgot-password"}
                className="text-sm font-medium text-brand-500 hover:text-brand-700"
              >
                {t("Forgot password?")}
              </Link>
            </div>
          </div>

          <FormAlert error={error} notice={notice} />
          <SubmitButton loading={submitting}>{t("Log in")}</SubmitButton>
        </form>

        <SecurityNote />
      </AuthCard>
    </AuthLayout>
  );
}
