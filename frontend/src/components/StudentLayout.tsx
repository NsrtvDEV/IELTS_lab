import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

export function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-6">
            <Link to="/" className="origin-left scale-[0.8]">
              <Logo />
            </Link>
            <nav className="flex gap-1" aria-label="Main">
              {[
                ["/", "Tests"],
                ["/progress", "Progress"],
              ].map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink"}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
