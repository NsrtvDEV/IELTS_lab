import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  GraduationCap,
  Headphones,
  Mic,
  PenLine,
  Play,
  Send,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiClient, resolveMediaUrl } from "../api/client";
import { getLanding } from "../api/site";
import { lang, locale, t } from "../i18n";
import { TELEGRAM_URL } from "../lib/config";
import { EMPTY_CONTENT, resolveTexts, withDefaults, type LandingContent, type ResolvedTexts } from "../lib/landing";
import london from "../assets/london.jpg";
import mountains from "../assets/mountains.jpg";

const YEAR = new Date().getFullYear();

type NavEntry = readonly [string, string];
const ALL_NAV: NavEntry[] = [
  ["#top", "Home"],
  ["#features", "Features"],
  ["#skills", "Skills"],
  ["#about", "About"],
];

type PublicStats = { students: number; tests: number; sections_completed: number };

const STATS: { icon: LucideIcon; key: keyof PublicStats; label: string }[] = [
  { icon: Users, key: "students", label: "Students" },
  { icon: BookOpen, key: "tests", label: "Mock Tests" },
  { icon: TrendingUp, key: "sections_completed", label: "Sections Completed" },
];

const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

/** Реальные цифры из базы; пока грузятся — заглушки, при ошибке блок скрывается */
function useStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    apiClient
      .get<PublicStats>("/stats")
      .then(({ data }) => setStats(data))
      .catch(() => setFailed(true));
  }, []);
  return { stats, failed };
}

const FEATURE_ICONS: LucideIcon[] = [BookOpen, Target, UserRound, Trophy];

const SKILL_STYLES: { icon: LucideIcon; tone: string; iconTone: string }[] = [
  { icon: BookOpen, tone: "from-brand-50", iconTone: "text-brand-500 bg-brand-100" },
  { icon: Headphones, tone: "from-emerald-50", iconTone: "text-emerald-600 bg-emerald-100" },
  { icon: PenLine, tone: "from-violet-50", iconTone: "text-violet-600 bg-violet-100" },
  { icon: Mic, tone: "from-rose-50", iconTone: "text-rose-500 bg-rose-100" },
];

// фото растворяется слева и снизу в фоне страницы
const PHOTO_FADE = {
  maskImage: "linear-gradient(to right, transparent 0%, black 30%)",
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 30%)",
} as const;

function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <GraduationCap className={`${small ? "h-6 w-6" : "h-8 w-8"} fill-brand-500 text-brand-500`} strokeWidth={1.75} />
      <span className={`${small ? "text-base" : "text-xl"} font-bold tracking-tight text-ink`}>BandUp</span>
    </span>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200";

const HEADER_OFFSET = 120; // высота шапки с запасом: раздел активен, когда дошёл до неё

/** Какой раздел меню сейчас на экране — последний, чей верх уже прокручен под шапку */
function useActiveSection(NAV: NavEntry[]): string {
  const [active, setActive] = useState<string>(NAV[0][0]);
  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      // в самом низу страницы последний раздел может не дойти до шапки — считаем активным его
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        setActive(NAV[NAV.length - 1][0]);
        return;
      }
      let current: string = NAV[0][0];
      for (const [href] of NAV) {
        const el = document.querySelector(href);
        if (el && el.getBoundingClientRect().top <= HEADER_OFFSET) current = href;
      }
      setActive(current);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [NAV]);
  return active;
}

function NavLinks({ nav: NAV }: { nav: NavEntry[] }) {
  const active = useActiveSection(NAV);
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [bar, setBar] = useState({ left: 0, width: 0 });

  // полоска под активным пунктом: положение берём из самой ссылки и анимируем переезд
  useLayoutEffect(() => {
    function place() {
      const el = links.current[active];
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    }
    place();
    document.fonts?.ready.then(place); // ширина слов меняется, когда догружается шрифт
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);

  return (
    <nav className="relative hidden gap-7 md:flex" aria-label={t("Main")}>
      {NAV.map(([href, label]) => (
        <a
          key={href}
          ref={(el) => {
            links.current[href] = el;
          }}
          href={href}
          aria-current={active === href ? "location" : undefined}
          className={`py-2 text-sm font-medium transition-colors ${
            active === href ? "text-brand-500" : "text-ink-muted hover:text-ink"
          }`}
        >
          {t(label)}
        </a>
      ))}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 h-0.5 rounded-full bg-brand-500 transition-all duration-300 ease-out"
        style={{ left: bar.left, width: bar.width }}
      />
    </nav>
  );
}

function Header({ nav }: { nav: NavEntry[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <a href="#top" aria-label="BandUp home">
            <Brand />
          </a>
          <NavLinks nav={nav} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="hidden h-10 items-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-ink transition hover:bg-slate-50 sm:inline-flex"
          >
            {t("Log in")}
          </Link>
          <Link to="/register" className={`${primaryBtn} h-10 px-5 text-sm`}>
            {t("Get Started")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ c, showStats, image }: { c: ResolvedTexts; showStats: boolean; image: string }) {
  const { stats, failed } = useStats();
  return (
    <section id="top" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-[#eef4ff] to-[#f7f9fd]">
      {/* фото Лондона справа, в мягкой волне */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] lg:block">
        <div className="absolute inset-y-6 right-0 left-10 overflow-hidden rounded-l-[120px]">
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover object-[50%_35%]"
            style={PHOTO_FADE}
          />
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:pb-24 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100/70 px-3 py-1 text-xs font-semibold text-brand-700">
            <Star className="h-3.5 w-3.5" />
            {c.hero_badge}
          </span>
          <h1 className="mt-5 text-[44px] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            {c.hero_title}
            <br />
            <span className="text-brand-500">{c.hero_title_accent}</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
            {c.hero_subtitle}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/register" className={`${primaryBtn} h-14 px-7 text-base`}>
              {c.hero_primary} <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-white px-7 text-base font-semibold text-ink transition hover:bg-slate-50"
            >
              <Play className="h-4 w-4 fill-current" /> {c.hero_secondary}
            </a>
          </div>

          {showStats && !failed && (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
              {STATS.map(({ icon: Icon, key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100/70 text-brand-500">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <dt className="sr-only">{t(label)}</dt>
                    <dd className="text-lg font-bold text-ink">
                      {stats ? (
                        compact.format(stats[key])
                      ) : (
                        <span className="inline-block h-5 w-10 animate-pulse rounded bg-slate-200 align-middle" />
                      )}
                    </dd>
                    <dd className="text-sm text-ink-muted">{t(label)}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* декоративный слой поверх фото: рукописная фраза и карточка band */}
        <div className="relative hidden min-h-[380px] lg:block" aria-hidden="true">
          <p className="absolute left-2 top-16 -rotate-12 font-hand text-[26px] leading-tight text-ink/80">
            {c.hero_note.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </p>
          <svg viewBox="0 0 80 40" className="absolute left-16 top-52 h-10 w-20 text-ink/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 30 C 20 42, 45 36, 70 10" />
            <path d="M58 9 L 71 9 L 68 22" />
          </svg>

          <div className="absolute bottom-10 right-0 w-60 -rotate-3 rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-ink-muted">{t("Your target band")}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-ink">7.5</span>
                  <span className="text-sm font-bold text-emerald-500">+0.5</span>
                </div>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <Target className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-slate-100">
              <div className="h-full w-3/4 rounded-full bg-brand-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features({ c }: { c: ResolvedTexts }) {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{c.features_eyebrow}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {c.features_title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">
            {c.features_subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {c.features.map(({ title, text }, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <article
                key={i}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 transition hover:-translate-y-1 hover:shadow-card"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100/70 text-brand-500">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
                <Link
                  to="/register"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-600"
                >
                  {t("Learn more")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Skills({ c }: { c: ResolvedTexts }) {
  return (
    <section id="skills" className="scroll-mt-20 bg-[#f3f7fe] py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[300px_1fr]">
        <div>
          <span className="inline-block rounded-full bg-brand-100/70 px-3 py-1 text-xs font-semibold uppercase text-brand-700">
            {c.skills_badge}
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{c.skills_title}</h2>
          <p className="mt-3 leading-relaxed text-ink-muted">
            {c.skills_subtitle}
          </p>
          <Link to="/register" className={`${primaryBtn} mt-6 h-11 px-6 text-sm`}>
            {c.skills_button} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {c.skills.map(({ title, text }, i) => {
            const { icon: Icon, tone, iconTone } = SKILL_STYLES[i];
            return (
              <Link
                key={i}
                to="/register"
                className={`group relative overflow-hidden rounded-2xl border border-white bg-gradient-to-br to-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-card ${tone}`}
              >
                {/* крупная полупрозрачная иконка в углу вместо иллюстрации */}
                <Icon className="absolute -right-3 -top-3 h-24 w-24 opacity-10" strokeWidth={1.25} aria-hidden="true" />
                <span className={`relative flex h-11 w-11 items-center justify-center rounded-full ${iconTone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="relative mt-4 font-bold text-ink">{title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
                <ArrowRight className="relative mt-4 h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-brand-500" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function About({ c, telegram }: { c: ResolvedTexts; telegram: string | null }) {
  return (
    <section id="about" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_400px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{c.about_eyebrow}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {c.about_title}
          </h2>
          <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-ink-muted">{c.about_text}</p>
          <ul className="mt-6 space-y-3">
            {c.about_points.map((point) => (
              <li key={point} className="flex gap-3 text-ink">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-[#f3f7fe] p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#229ED9]/10 text-[#229ED9]">
            <Send className="h-7 w-7" />
          </span>
          <h3 className="mt-5 text-xl font-bold text-ink">{c.contact_title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {c.contact_text}
          </p>
          {telegram ? (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#229ED9] px-6 text-sm font-semibold text-white shadow-lg shadow-[#229ED9]/25 transition hover:bg-[#1c8cc2]"
            >
              <Send className="h-4 w-4" /> {c.contact_button}
            </a>
          ) : (
            <Link to="/register" className={`${primaryBtn} mt-6 h-11 px-6 text-sm`}>
              {t("Join BandUp")} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function CallToAction({ c }: { c: ResolvedTexts }) {
  return (
    <section className="bg-white pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0f1f5c] px-6 py-8 sm:px-10">
          <img src={mountains} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f1f5c] via-[#0f1f5c]/85 to-transparent" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand-300 sm:flex">
                <TrendingUp className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white">{c.cta_title}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {c.cta_text}
                </p>
              </div>
            </div>
            <Link
              to="/register"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-ink transition hover:bg-brand-50"
            >
              {c.cta_button} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ telegram }: { telegram: string | null }) {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-5">
          <Brand small />
          <span className="text-sm text-ink-muted">© {YEAR} BandUp. {t("All rights reserved.")}</span>
        </div>
        <nav className="flex gap-6 text-sm text-ink-muted" aria-label={t("Footer")}>
          <Link to="/login" className="hover:text-ink">{t("Log in")}</Link>
          <Link to="/register" className="hover:text-ink">{t("Sign up")}</Link>
          {telegram && (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-[#229ED9]"
            >
              <Send className="h-4 w-4" /> Telegram
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}

/** Лендинг по готовому содержимому — и для гостей, и для предпросмотра в редакторе админа */
export function LandingView({ content, language = lang }: { content: LandingContent; language?: typeof lang }) {
  const c = resolveTexts(content, language);
  const st = content.settings;
  const telegram = st.telegram_url || TELEGRAM_URL;
  const nav = useMemo(
    () =>
      ALL_NAV.filter(
        ([href]) =>
          (href !== "#features" || st.show_features) && (href !== "#skills" || st.show_skills) && (href !== "#about" || st.show_about)
      ),
    [st.show_features, st.show_skills, st.show_about]
  );
  return (
    <div className="min-h-screen">
      <Header nav={nav} />
      <main>
        <Hero c={c} showStats={st.show_stats} image={resolveMediaUrl(st.hero_image_url) ?? london} />
        {st.show_features && <Features c={c} />}
        {st.show_skills && <Skills c={c} />}
        {st.show_about && <About c={c} telegram={telegram} />}
        {st.show_cta && <CallToAction c={c} />}
      </main>
      <Footer telegram={telegram} />
    </div>
  );
}

const LOAD_TIMEOUT_MS = 1500; // сервер не ответил — показываем стандартные тексты

/** Публичная главная для гостей: тексты, заданные админом */
export function LandingPage() {
  const [content, setContent] = useState<LandingContent | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setContent((c) => c ?? EMPTY_CONTENT), LOAD_TIMEOUT_MS);
    getLanding()
      .then((data) => setContent(withDefaults(data)))
      .catch(() => setContent(EMPTY_CONTENT));
    return () => window.clearTimeout(timer);
  }, []);
  // пока тексты грузятся (обычно доли секунды) — пустой фон, без мигания стандартных текстов
  if (!content) return <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] to-[#f7f9fd]" />;
  return <LandingView content={content} />;
}
