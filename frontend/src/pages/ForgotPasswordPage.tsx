import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { requestPasswordReset } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import { AuthCard, AuthSwitchLink, FormAlert, SubmitButton, TextField } from "../components/AuthForm";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { lang, t } from "../i18n";

/** «Забыли пароль?»: письмо со ссылкой на новый пароль */
export function ForgotPasswordPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t("Enter a valid email address"));
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim(), lang);
      setSentTo(email.trim());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthSwitchLink question={t("Remembered your password?")} to="/login" label={t("Log in")} />

      {sentTo ? (
        <AuthCard title={t("Check your email")} subtitle={t("We've sent a link to {email}", { email: sentTo })}>
          <div className="mt-8 flex gap-4 rounded-xl bg-brand-50 px-5 py-4 text-sm text-ink">
            <MailCheck className="h-6 w-6 shrink-0 text-brand-500" />
            <p className="leading-relaxed">
              {t(
                "If an account with this email exists, the email will arrive in a minute or two. Open the link in it to set a new password — it works for 1 hour. Don't see it? Check the Spam folder."
              )}
            </p>
          </div>
          <button
            onClick={() => setSentTo(null)}
            className="mt-6 text-sm font-medium text-brand-500 hover:text-brand-700"
          >
            {t("Send again or use another email")}
          </button>
          <Link to="/login" className="mt-8 flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {t("Back to log in")}
          </Link>
        </AuthCard>
      ) : (
        <AuthCard
          title={t("Forgot your password?")}
          subtitle={t("Enter the email you signed up with — we'll send you a link to set a new password.")}
        >
          <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
            <TextField
              id="email"
              label={t("Email address")}
              icon={Mail}
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <FormAlert error={error} />
            <SubmitButton loading={submitting}>{t("Send link")}</SubmitButton>
          </form>
          <Link to="/login" className="mt-8 flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {t("Back to log in")}
          </Link>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
