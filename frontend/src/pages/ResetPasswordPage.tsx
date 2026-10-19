import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { checkPasswordResetToken, confirmPasswordReset } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import { AuthCard, AuthSwitchLink, FormAlert, PasswordField, SubmitButton } from "../components/AuthForm";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n";

const MIN_PASSWORD = 8;

/** Новый пароль по ссылке из письма: /reset-password?token=... */
export function ResetPasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    checkPasswordResetToken(token)
      .then(() => setStatus("ready"))
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(t("Use at least {n} characters", { n: MIN_PASSWORD }));
    if (password !== confirm) return setError(t("Passwords do not match"));
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      // сервер закрыл все сессии — выходим и здесь, если кто-то был залогинен в этом браузере
      if (user) await logout();
      setStatus("done");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthSwitchLink question={t("Remembered your password?")} to="/login" label={t("Log in")} />

      {status === "checking" && (
        <div className="flex flex-1 items-center justify-center text-ink-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {status === "invalid" && (
        <AuthCard title={t("The link doesn't work")} subtitle={t("This link is invalid or has expired. Request a new one.")}>
          <div className="mt-8 flex gap-3 rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            {t("A link works once and only for 1 hour. If you requested several emails, use the latest one.")}
          </div>
          <Link
            to="/forgot-password"
            className="mt-8 flex h-14 w-full items-center justify-center rounded-xl bg-brand-500 text-base font-semibold text-white hover:bg-brand-600"
          >
            {t("Get a new link")}
          </Link>
        </AuthCard>
      )}

      {status === "done" && (
        <AuthCard title={t("Password changed")} subtitle={t("You can now log in with your new password.")}>
          <div className="mt-8 flex gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {t("For your security, you've been signed out on all devices.")}
          </div>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="mt-8 flex h-14 w-full items-center justify-center rounded-xl bg-brand-500 text-base font-semibold text-white hover:bg-brand-600"
          >
            {t("Log in")}
          </button>
        </AuthCard>
      )}

      {status === "ready" && (
        <AuthCard title={t("Set a new password")} subtitle={t("Choose a password you don't use on other sites.")}>
          <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
            <PasswordField
              id="new-password"
              label={t("New password")}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Create a password")}
              hint={t("At least {n} characters", { n: MIN_PASSWORD })}
            />
            <PasswordField
              id="confirm-password"
              label={t("Confirm password")}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("Repeat your password")}
            />
            <FormAlert error={error} />
            <SubmitButton loading={submitting}>{t("Save new password")}</SubmitButton>
          </form>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
