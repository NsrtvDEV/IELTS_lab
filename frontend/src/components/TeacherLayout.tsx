import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { FileText, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import { DJANGO_ADMIN_URL } from "../lib/config";

export function TeacherLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const name = [user?.profile?.first_name, user?.profile?.last_name].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <div className="origin-left scale-[0.7]">
            <Logo />
          </div>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/teacher/tests"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink"
                }`
              }
            >
              <FileText className="h-4 w-4" /> Tests
            </NavLink>
            <a
              href={DJANGO_ADMIN_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-ink">{name || user?.email}</div>
              <div className="text-xs capitalize text-ink-muted">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 hover:text-ink"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
