import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail, UserRound } from "lucide-react";
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

const MIN_PASSWORD = 8; // как на бэкенде (RegisterRequest)

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
};
type Errors = Partial<Record<keyof Form, string>>;

function validate(form: Form): Errors {
  const errors: Errors = {};
  if (!form.firstName.trim()) errors.firstName = t("Enter your first name");
  if (!form.lastName.trim()) errors.lastName = t("Enter your last name");
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = t("Enter a valid email address");
  if (form.password.length < MIN_PASSWORD) {
    errors.password = t("Use at least {n} characters", { n: MIN_PASSWORD });
  }
  if (form.confirm !== form.password) errors.confirm = t("Passwords do not match");
  return errors;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<Form>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function field(name: keyof Form) {
    return {
      value: form[name],
      error: errors[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((f) => ({ ...f, [name]: e.target.value }));
        // ошибку поля убираем, как только его начали исправлять
        if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }));
      },
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await register({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthSwitchLink question={t("Already have an account?")} to="/login" label={t("Log in")} />

      <AuthCard title={t("Create your account")} subtitle={t("Start preparing for your IELTS today")}>
        <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              id="first-name"
              label={t("First name")}
              icon={UserRound}
              autoComplete="given-name"
              placeholder={t("John")}
              maxLength={100}
              {...field("firstName")}
            />
            <TextField
              id="last-name"
              label={t("Last name")}
              icon={UserRound}
              autoComplete="family-name"
              placeholder={t("Smith")}
              maxLength={100}
              {...field("lastName")}
            />
          </div>

          <TextField
            id="email"
            label={t("Email address")}
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...field("email")}
          />

          <PasswordField
            id="password"
            label={t("Password")}
            autoComplete="new-password"
            placeholder={t("Create a password")}
            hint={t("At least {n} characters", { n: MIN_PASSWORD })}
            {...field("password")}
          />

          <PasswordField
            id="confirm-password"
            label={t("Confirm password")}
            autoComplete="new-password"
            placeholder={t("Repeat your password")}
            {...field("confirm")}
          />

          <FormAlert error={error} />
          <SubmitButton loading={submitting}>{t("Create account")}</SubmitButton>
        </form>

        <SecurityNote />
      </AuthCard>
    </AuthLayout>
  );
}
