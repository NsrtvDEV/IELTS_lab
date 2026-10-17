import { useState, type FormEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  House,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import mountains from "../assets/mountains.jpg";
import { useAuth } from "../context/AuthContext";
import { DJANGO_ADMIN_URL } from "../lib/config";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

const NAV: { label: string; icon: LucideIcon; to?: string }[] = [
  { label: "Dashboard", icon: House, to: "/teacher" },
  { label: "Students", icon: UsersRound, to: "/teacher/students" },
  { label: "Classes", icon: CalendarDays },
  { label: "Tests", icon: ClipboardList, to: "/teacher/tests" },
  { label: "Results", icon: BarChart3 },
  { label: "Content", icon: BookOpen },
  { label: "Messages", icon: MessageSquare },
  { label: "Settings", icon: Settings },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // редактор секции — часть раздела Tests
  const inTests = pathname.startsWith("/teacher/sections");
  return (
    <div className="flex h-full flex-col px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="mt-10 space-y-1.5" aria-label="Main">
        {NAV.map(({ label, icon: Icon, to }) =>
          to ? (
            <NavLink
              key={label}
              to={to}
              end={to === "/teacher"}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex h-11 items-center gap-4 rounded-xl px-4 text-[15px] font-medium transition ${
                  isActive || (to === "/teacher/tests" && inTests)
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                    : "text-ink hover:bg-slate-100"
                }`
              }
            >
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ) : (
            // разделы, которых ещё нет на бэкенде
            <div
              key={label}
              className="flex h-11 cursor-not-allowed items-center gap-4 rounded-xl px-4 text-[15px] font-medium text-slate-400"
              title="Coming soon"
            >
              <Icon className="h-5 w-5" /> {label}
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                Soon
              </span>
            </div>
          )
        )}
      </nav>

      <div className="mt-auto space-y-4 pt-8">
        <a
          href={DJANGO_ADMIN_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
        >
          <ShieldCheck className="h-5 w-5 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold capitalize text-ink">{user?.role}</div>
            <div className="text-xs text-ink-muted">Admin panel</div>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-muted" />
        </a>
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
    </div>
  );
}

export function TeacherLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function search(e: FormEvent) {
    e.preventDefault();
    navigate(`/teacher/tests?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r border-slate-200/70 bg-white lg:block">
        <Sidebar />
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-ink-muted hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f7f9fd]/90 backdrop-blur">
        <div className="flex h-[72px] items-center gap-4 px-4 sm:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-ink hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <form onSubmit={search} className="relative w-full max-w-md" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests…"
              aria-label="Search tests"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-xl p-2.5 text-ink-muted hover:bg-slate-100"
              title="No new notifications"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
