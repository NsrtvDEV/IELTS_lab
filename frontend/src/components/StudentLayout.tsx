import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Headphones,
  House,
  Mic,
  PenLine,
  Settings,
  Trophy,
  UserRound,
} from "lucide-react";
import mountains from "../assets/mountains.jpg";
import { AppShell, type NavItem } from "./AppShell";

// страницы результатов и прогресса — часть раздела Results
const isResult = (p: string) => p.endsWith("/result") || p === "/progress";

const NAV: NavItem[] = [
  { label: "Dashboard", icon: House, to: "/", end: true },
  { label: "Reading", icon: BookOpen, to: "/practice/reading" },
  { label: "Listening", icon: Headphones, to: "/practice/listening" },
  { label: "Writing", icon: PenLine, to: "/practice/writing" },
  { label: "Speaking", icon: Mic, to: "/practice/speaking" },
  { label: "Mock Tests", icon: ClipboardList, to: "/tests" },
  { label: "Results", icon: Trophy, to: "/results", alsoActive: isResult },
  { label: "Profile", icon: UserRound, to: "/profile", gapBefore: true },
  { label: "Settings", icon: Settings },
];

function Footer() {
  return (
    <div className="relative hidden h-72 overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50 to-white lg:block">
      <img src={mountains} alt="" className="absolute bottom-0 h-1/2 w-full object-cover" />
      <div className="relative px-5 pt-7">
        <p className="text-xl font-bold leading-snug text-ink">
          Your goal
          <br />
          is closer than
          <br />
          you think.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">Keep going, you&apos;re doing great!</p>
        <Link
          to="/progress"
          className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/30 hover:bg-brand-600"
          aria-label="See my progress"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={NAV} footer={<Footer />} searchPath="/tests">
      {children}
    </AppShell>
  );
}
