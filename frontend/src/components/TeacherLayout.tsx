import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  House,
  MessageSquare,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import mountains from "../assets/mountains.jpg";
import { useAuth } from "../context/AuthContext";
import { DJANGO_ADMIN_URL } from "../lib/config";
import { AppShell, type NavItem } from "./AppShell";

const NAV: NavItem[] = [
  { label: "Dashboard", icon: House, to: "/teacher", end: true },
  { label: "Students", icon: UsersRound, to: "/teacher/students" },
  // редактор секции — часть раздела Tests
  { label: "Tests", icon: ClipboardList, to: "/teacher/tests", alsoActive: (p) => p.startsWith("/teacher/sections") },
  { label: "Review", icon: ClipboardCheck, to: "/teacher/review" },
  { label: "Content", icon: BookOpen },
  { label: "Messages", icon: MessageSquare },
  { label: "Settings", icon: Settings },
];

function Footer() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      {/* Django-админка — только для администраторов */}
      {user?.role === "admin" && (
        <a
          href={DJANGO_ADMIN_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
        >
          <ShieldCheck className="h-5 w-5 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold capitalize text-ink">{user.role}</div>
            <div className="text-xs text-ink-muted">Admin panel</div>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-muted" />
        </a>
      )}
      <div className="relative hidden h-56 overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50 to-white lg:block">
        <img src={mountains} alt="" className="absolute bottom-0 h-3/5 w-full object-cover" />
        <p className="relative px-5 pt-8 font-hand text-xl leading-snug text-ink">
          “Better students
          <br />
          for a brighter future”
        </p>
        <p className="relative mt-2 px-5 text-xs text-ink-muted">— BandUp</p>
      </div>
    </div>
  );
}

export function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={NAV} footer={<Footer />} searchPath="/teacher/tests">
      {children}
    </AppShell>
  );
}
