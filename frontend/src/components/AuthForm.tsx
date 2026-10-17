// Общие элементы страниц входа и регистрации
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";

/** Ссылка в правом верхнем углу: "Don't have an account? Sign up" и наоборот */
export function AuthSwitchLink({ question, to, label }: { question: string; to: string; label: string }) {
  return (
    <div className="flex items-center justify-between lg:justify-end">
      <div className="lg:hidden">
        <Logo />
      </div>
      <p className="text-sm text-ink-muted">
        <span className="hidden sm:inline">{question}</span>
        <Link
          to={to}
          className="ml-5 inline-flex items-center gap-2 font-semibold text-brand-500 hover:text-brand-700"
        >
          {label} <ArrowRight className="h-4 w-4" />
        </Link>
      </p>
    </div>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="w-full max-w-[560px] rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
          <GraduationCap className="h-8 w-8 fill-brand-500 text-brand-500" strokeWidth={1.75} />
        </span>
        <h2 className="mt-5 text-[34px] font-extrabold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-lg text-ink-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "h-14 w-full rounded-xl border bg-white pl-12 pr-4 text-[15px] text-ink outline-none transition placeholder:text-slate-400 focus:ring-4";
const inputOk = "border-slate-200 focus:border-brand-400 focus:ring-brand-100";
const inputBad = "border-red-300 focus:border-red-400 focus:ring-red-100";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  trailing?: ReactNode; // кнопка справа внутри поля (глаз у пароля)
};

export function TextField({ id, label, icon: Icon, error, hint, trailing, className, ...input }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${inputClass} ${error ? inputBad : inputOk} ${trailing ? "pr-12" : ""}`}
          {...input}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "icon" | "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      icon={LockKeyhole}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted hover:text-ink"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>
      }
    />
  );
}

export function FormAlert({ error, notice }: { error?: string | null; notice?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
        {notice}
      </p>
    );
  }
  return null;
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          {children} <ArrowRight className="h-5 w-5" />
        </>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Разделитель "or" и кнопка Google (вход через Google на бэкенде пока не реализован) */
export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <div className="my-7 flex items-center gap-4 text-sm text-ink-muted">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button
        type="button"
        onClick={onClick}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-base font-semibold text-ink transition hover:bg-slate-50"
      >
        <GoogleIcon /> Continue with Google
      </button>
    </>
  );
}

export function SecurityNote() {
  return (
    <div className="mt-9 flex items-center gap-4 rounded-xl bg-slate-50 px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
        <ShieldCheck className="h-5 w-5 fill-brand-500 text-white" />
      </span>
      <div>
        <div className="text-sm font-medium text-ink">Your data is safe with us</div>
        <div className="mt-0.5 text-xs text-ink-muted">
          We use industry-standard security to protect your information.
        </div>
      </div>
    </div>
  );
}
