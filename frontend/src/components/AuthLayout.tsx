import type { ReactNode } from "react";
import { BookOpen, Target, UserRound, type LucideIcon } from "lucide-react";
import london from "../assets/london.jpg";
import { Logo } from "./Logo";
import { t } from "../i18n";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BookOpen, title: t("Real IELTS Practice"), text: t("Updated test formats and authentic questions") },
  { icon: Target, title: t("Track Your Progress"), text: t("See your improvement and stay motivated") },
  { icon: UserRound, title: t("Personalized Learning"), text: t("Your goals, your pace, your success") },
];

const FADE =
  "linear-gradient(to right, transparent 0%, black 45%), linear-gradient(to bottom, transparent 0%, black 30%)";
const PHOTO_FADE = {
  maskImage: FADE,
  maskComposite: "intersect",
  WebkitMaskImage: FADE,
  WebkitMaskComposite: "source-in",
} as const;

function HeroPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br lg:sticky lg:top-0 lg:h-screen from-[#e9f1ff] via-[#f4f8ff] to-white lg:block">
      {/* фото Лондона внизу справа: левый и верхний края растворяются в фоне */}
      <img src={london} alt="" className="absolute bottom-0 right-0 h-[60%] w-[58%] object-cover" style={PHOTO_FADE} />
      {/* светлая диагональная волна, как на макете */}
      <div className="pointer-events-none absolute -right-40 top-0 h-full w-80 -skew-x-12 bg-white/40 blur-sm" />

      <div className="relative flex h-full flex-col px-16 py-16 xl:px-20">
        <Logo />

        <h1 className="mt-16 text-5xl font-extrabold leading-[1.08] tracking-tight text-ink xl:text-[56px]">
          {t("Your IELTS journey")}
          <br />
          <span className="text-brand-500">{t("starts here.")}</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
          {t("Achieve your target band with personalized practice, real test formats and expert guidance.")}
        </p>

        <ul className="mt-10 space-y-6">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100/70">
                <Icon className="h-6 w-6 text-brand-500" strokeWidth={2.25} />
              </span>
              <div>
                <div className="font-semibold text-ink">{title}</div>
                <div className="mt-0.5 text-sm text-ink-muted">{text}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-16">
          <p className="-rotate-12 font-hand text-[32px] leading-tight text-brand-600">
            {t("Better English")}
            <br />
            <span className="ml-2">{t("Bigger Opportunities")}</span>
          </p>
          <svg
            viewBox="0 0 120 60"
            className="ml-20 mt-10 h-14 w-28 -rotate-6 text-brand-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 52 C 40 50, 75 38, 110 10" />
            <path d="M92 10 L 111 9 L 106 27" />
          </svg>
        </div>
      </div>
    </aside>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <HeroPanel />
      <main className="flex min-w-0 flex-col bg-[#f7f9fd] px-4 py-8 sm:px-10 lg:px-16">{children}</main>
    </div>
  );
}
