import { LANGUAGES, lang, setLang, t } from "../i18n";

/** Компактный переключатель EN / RU (страницы входа и регистрации) */
export function LanguageSwitch() {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold" role="radiogroup" aria-label={t("Interface language")}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          role="radio"
          aria-checked={lang === code}
          title={label}
          onClick={() => setLang(code)}
          className={`rounded-md px-2.5 py-1 uppercase ${lang === code ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
