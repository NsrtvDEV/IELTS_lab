import { useState, type FormEvent } from "react";
import { CheckCircle2, Languages, KeyRound } from "lucide-react";
import { changePassword } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import { Button, Card, ErrorBox, Label, inputClass } from "../components/ui";
import { LANGUAGES, lang, setLang, t } from "../i18n";

/** Настройки (ученик и учитель): язык интерфейса и смена пароля */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Settings")}</h1>
      <LanguageCard />
      <PasswordCard />
    </div>
  );
}

function LanguageCard() {
  return (
    <Card className="mt-6 p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Languages className="h-5 w-5 text-brand-500" /> {t("Interface language")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Menus, buttons and messages. Tests stay in English, as in the real IELTS.")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("Interface language")}>
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            role="radio"
            aria-checked={lang === code}
            onClick={() => setLang(code)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold transition ${
              lang === code ? "border-brand-400 bg-brand-50 text-brand-700 ring-4 ring-brand-100" : "border-slate-200 text-ink hover:bg-slate-50"
            }`}
          >
            {label}
            {lang === code && <CheckCircle2 className="h-5 w-5" />}
          </button>
        ))}
      </div>
    </Card>
  );
}

export function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next.length < 8) return setError(t("The new password must be at least 8 characters."));
    if (next !== repeat) return setError(t("The new passwords don't match."));
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <KeyRound className="h-5 w-5 text-brand-500" /> {t("Change password")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("You'll stay signed in here and be signed out on other devices.")}</p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <div className="sm:w-1/2 sm:pr-2.5">
          <Label htmlFor="current-password">{t("Current password")}</Label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="new-password">{t("New password")}</Label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputClass}
              placeholder={t("At least 8 characters")}
              required
            />
          </div>
          <div>
            <Label htmlFor="repeat-password">{t("Repeat new password")}</Label>
            <input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>
        <ErrorBox message={error} />
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {t("Password changed")}
            </span>
          )}
          <Button type="submit" loading={saving}>
            {t("Change password")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
