import { useState, type FormEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X, type LucideIcon } from "lucide-react";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { t } from "../i18n";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
  /** раздел активен и на других адресах (например, редактор секции — часть Tests) */
  alsoActive?: (pathname: string) => boolean;
  gapBefore?: boolean; // отступ перед пунктом — новая группа меню
}

function Sidebar({ nav, footer, onNavigate }: { nav: NavItem[]; footer: ReactNode; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <div className="flex h-full flex-col px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="mt-10 space-y-1.5" aria-label={t("Main")}>
        {nav.map(({ label, icon: Icon, to, end, alsoActive, gapBefore }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `${gapBefore ? "!mt-8 " : ""}flex h-11 items-center gap-4 rounded-xl px-4 text-[15px] font-medium transition ${
                isActive || alsoActive?.(pathname)
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                  : "text-ink hover:bg-slate-100"
              }`
            }
          >
            <Icon className="h-5 w-5" /> {t(label)}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-8">{footer}</div>
    </div>
  );
}

/** Кабинет: меню слева (на телефоне — выдвижное), сверху поиск тестов и профиль */
export function AppShell({
  nav,
  footer,
  searchPath,
  children,
}: {
  nav: NavItem[];
  footer: ReactNode;
  searchPath: string; // куда ведёт поиск: ?q=<запрос>
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function search(e: FormEvent) {
    e.preventDefault();
    navigate(`${searchPath}?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r border-slate-200/70 bg-white lg:block">
        <Sidebar nav={nav} footer={footer} />
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-ink-muted hover:bg-slate-100"
              aria-label={t("Close menu")}
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar nav={nav} footer={footer} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f7f9fd]/90 backdrop-blur">
        <div className="flex h-[72px] items-center gap-4 px-4 sm:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-ink hover:bg-slate-100 lg:hidden"
            aria-label={t("Open menu")}
          >
            <Menu className="h-5 w-5" />
          </button>
          <form onSubmit={search} className="relative w-full max-w-md" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search tests…")}
              aria-label={t("Search tests")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
