import { RU, RU_PATTERNS, RU_PLURALS } from "./ru";

/** Язык интерфейса. Тесты (тексты, вопросы, инструкции) всегда на английском, как на настоящем IELTS. */
export type Lang = "en" | "ru";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

const STORAGE_KEY = "bandup_lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru") return saved;
  } catch {
    // хранилище недоступно — берём язык браузера
  }
  return /^(ru|uz)/i.test(navigator.language) ? "ru" : "en";
}

/** Язык выбирается при загрузке; смена языка перезагружает страницу */
export const lang: Lang = detect();
document.documentElement.lang = lang;

/** Локаль для дат и чисел */
export const locale = lang === "ru" ? "ru-RU" : "en";

export function setLang(next: Lang) {
  if (next === lang) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  window.location.reload();
}

function fill(text: string, vars?: Record<string, string | number>) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Тексты с сервера с числами и названиями внутри: шаблоны вида [/^(\d+) questions$/, "$1 вопросов"] */
function fromPattern(text: string): string | undefined {
  for (const [re, ru] of RU_PATTERNS) {
    if (re.test(text)) return text.replace(re, ru);
  }
  return undefined;
}

/** Перевод: ключ — английский текст; нет перевода — показываем английский. Переменные: {name} */
export function t(text: string, vars?: Record<string, string | number>): string {
  if (lang === "en") return fill(text, vars);
  const ru = RU[text] ?? fromPattern(text);
  if (ru === undefined && import.meta.env.DEV) console.warn(`[i18n] no translation: ${JSON.stringify(text)}`);
  return fill(ru ?? text, vars);
}

const ruRules = new Intl.PluralRules("ru-RU");

/** Число со словом: tn(5, "{n} question", "{n} questions") → «5 вопросов» */
export function tn(n: number, one: string, other: string): string {
  if (lang === "en") return fill(n === 1 ? one : other, { n });
  const forms = RU_PLURALS[other];
  if (!forms) {
    if (import.meta.env.DEV) console.warn(`[i18n] no plural: ${JSON.stringify(other)}`);
    return fill(n === 1 ? one : other, { n });
  }
  const form = ruRules.select(n);
  return fill(form === "one" ? forms[0] : form === "few" ? forms[1] : forms[2], { n });
}
