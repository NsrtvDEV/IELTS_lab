import type { Lang } from "../i18n";

/** Тексты лендинга; админ меняет их на странице /admin/landing (то, что не задано, — стандартное) */
export interface LandingItem {
  title?: string;
  text?: string;
}

export interface LandingTexts {
  hero_badge?: string;
  hero_title?: string;
  hero_title_accent?: string;
  hero_subtitle?: string;
  hero_primary?: string;
  hero_secondary?: string;
  hero_note?: string; // рукописная фраза, строки через перенос
  features_eyebrow?: string;
  features_title?: string;
  features_subtitle?: string;
  features?: LandingItem[]; // 4 карточки
  skills_badge?: string;
  skills_title?: string;
  skills_subtitle?: string;
  skills_button?: string;
  skills?: LandingItem[]; // Reading, Listening, Writing, Speaking
  about_eyebrow?: string;
  about_title?: string;
  about_text?: string;
  about_points?: string[];
  contact_title?: string;
  contact_text?: string;
  contact_button?: string;
  cta_title?: string;
  cta_text?: string;
  cta_button?: string;
}

export interface LandingSettings {
  show_stats: boolean;
  show_features: boolean;
  show_skills: boolean;
  show_about: boolean;
  show_cta: boolean;
  hero_image_url?: string; // своя фотография на главном экране
  telegram_url?: string;
}

export interface LandingContent {
  settings: LandingSettings;
  en: LandingTexts;
  ru: LandingTexts;
}

export type ResolvedTexts = Required<Omit<LandingTexts, "features" | "skills">> & {
  features: Required<LandingItem>[];
  skills: Required<LandingItem>[];
};

export const DEFAULT_SETTINGS: LandingSettings = {
  show_stats: true,
  show_features: true,
  show_skills: true,
  show_about: true,
  show_cta: true,
};

export const EMPTY_CONTENT: LandingContent = { settings: DEFAULT_SETTINGS, en: {}, ru: {} };

export const DEFAULT_TEXTS: Record<Lang, ResolvedTexts> = {
  en: {
    hero_badge: "Your IELTS journey starts here",
    hero_title: "Prepare smarter.",
    hero_title_accent: "Score higher.",
    hero_subtitle:
      "BandUp is your all-in-one IELTS learning platform with real practice tests, progress tracking and personalized learning.",
    hero_primary: "Start Learning",
    hero_secondary: "See How It Works",
    hero_note: "Your goal\nis closer than\nyou think",
    features_eyebrow: "Why BandUp?",
    features_title: "Everything you need for IELTS success",
    features_subtitle:
      "Focus on what matters. We provide the tools, practice and support to help you reach your target band score.",
    features: [
      { title: "Real IELTS Practice", text: "Authentic questions and full mock tests for all 4 sections." },
      { title: "Track Your Progress", text: "See your scores, identify weak areas and improve step by step." },
      { title: "Personalized Learning", text: "Get recommendations based on your current level and goals." },
      { title: "Achieve Your Goals", text: "Build the skills and confidence you need for a higher band score." },
    ],
    skills_badge: "Four skills. One goal.",
    skills_title: "Master all 4 IELTS skills",
    skills_subtitle: "Practice Reading, Listening, Writing and Speaking with real exam formats and expert resources.",
    skills_button: "Explore All Skills",
    skills: [
      { title: "Reading", text: "Improve your reading skills with real passages and exam-style questions." },
      { title: "Listening", text: "Train with authentic audio and develop your listening comprehension." },
      { title: "Writing", text: "Learn task formats, get practice tips and improve your writing skills." },
      { title: "Speaking", text: "Practice real exam questions and build your confidence in speaking." },
    ],
    about_eyebrow: "About us",
    about_title: "Built for IELTS learners and teachers",
    about_text:
      "BandUp is an independent IELTS Academic preparation platform. We started it to make exam practice feel like the real test: the same formats, the same timing and honest scoring — so you know exactly where you stand and what to work on next.",
    about_points: [
      "Full IELTS Academic mock tests in the real exam format — or any single section",
      "Server-side timer, autosave and instant Listening & Reading scores on the official band scale",
      "Teachers build tests and follow every student's progress and mistakes",
    ],
    contact_title: "Questions or ideas?",
    contact_text:
      "Write to us on Telegram — we answer questions about the platform, tests and preparation, and we'd love to hear your feedback.",
    contact_button: "Message us on Telegram",
    cta_title: "Ready to start your IELTS journey?",
    cta_text: "Join thousands of students who are already achieving their dreams with BandUp.",
    cta_button: "Get Started Free",
  },
  ru: {
    hero_badge: "Ваш путь к IELTS начинается здесь",
    hero_title: "Готовьтесь умнее.",
    hero_title_accent: "Сдавайте выше.",
    hero_subtitle:
      "BandUp — платформа для подготовки к IELTS: настоящие пробные тесты, отслеживание прогресса и персональные рекомендации.",
    hero_primary: "Начать обучение",
    hero_secondary: "Как это работает",
    hero_note: "Ваша цель\nближе,\nчем кажется",
    features_eyebrow: "Почему BandUp?",
    features_title: "Всё для успешной сдачи IELTS",
    features_subtitle:
      "Сосредоточьтесь на главном. Мы даём инструменты, практику и поддержку, чтобы вы получили нужный балл.",
    features: [
      { title: "Практика как на IELTS", text: "Настоящие типы вопросов и полные пробные тесты по всем 4 секциям." },
      { title: "Отслеживайте прогресс", text: "Смотрите свои баллы, находите слабые места и улучшайте их шаг за шагом." },
      { title: "Персональное обучение", text: "Рекомендации с учётом вашего уровня и целей." },
      { title: "Достигайте целей", text: "Навыки и уверенность, которые нужны для высокого балла." },
    ],
    skills_badge: "Четыре навыка. Одна цель.",
    skills_title: "Все 4 навыка IELTS",
    skills_subtitle: "Тренируйте Reading, Listening, Writing и Speaking в формате настоящего экзамена.",
    skills_button: "Все навыки",
    skills: [
      { title: "Reading", text: "Настоящие тексты и вопросы в формате экзамена." },
      { title: "Listening", text: "Аутентичные записи — развивайте понимание на слух." },
      { title: "Writing", text: "Форматы заданий, советы и проверка эссе преподавателем." },
      { title: "Speaking", text: "Вопросы как на экзамене — отвечайте уверенно." },
    ],
    about_eyebrow: "О нас",
    about_title: "Для тех, кто учит и сдаёт IELTS",
    about_text:
      "BandUp — независимая платформа подготовки к IELTS Academic. Мы сделали её, чтобы практика была как настоящий экзамен: тот же формат, то же время и честная оценка — чтобы вы точно знали свой уровень и над чем работать дальше.",
    about_points: [
      "Полные пробные тесты IELTS Academic в формате экзамена — или любая секция отдельно",
      "Таймер на сервере, автосохранение и мгновенная оценка Listening и Reading по официальной шкале",
      "Преподаватели создают тесты и видят прогресс и ошибки каждого ученика",
    ],
    contact_title: "Есть вопросы или идеи?",
    contact_text:
      "Напишите нам в Telegram — ответим на вопросы о платформе, тестах и подготовке. Будем рады вашим отзывам.",
    contact_button: "Написать в Telegram",
    cta_title: "Готовы начать подготовку к IELTS?",
    cta_text: "Присоединяйтесь к ученикам, которые уже идут к своей цели с BandUp.",
    cta_button: "Начать бесплатно",
  },
};

/** Тексты на языке посетителя: заданное админом, иначе стандартное для этого языка */
export function resolveTexts(content: LandingContent, lang: Lang): ResolvedTexts {
  const own = content[lang] ?? {};
  const base = DEFAULT_TEXTS[lang];
  const pick = <K extends keyof ResolvedTexts>(key: K) => (own[key] as ResolvedTexts[K] | undefined) || base[key];
  const items = (list: LandingItem[] | undefined, defaults: Required<LandingItem>[]) =>
    defaults.map((d, i) => ({ title: list?.[i]?.title || d.title, text: list?.[i]?.text || d.text }));
  return {
    ...(Object.fromEntries(Object.keys(base).map((k) => [k, pick(k as keyof ResolvedTexts)])) as ResolvedTexts),
    features: items(own.features, base.features),
    skills: items(own.skills, base.skills),
    about_points: own.about_points?.length ? own.about_points : base.about_points,
  };
}

export function withDefaults(content: Partial<LandingContent> | undefined): LandingContent {
  return {
    settings: { ...DEFAULT_SETTINGS, ...content?.settings },
    en: content?.en ?? {},
    ru: content?.ru ?? {},
  };
}
