import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DJANGO_ADMIN_URL } from "../lib/config";
import { initials } from "../lib/format";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = [user?.profile?.first_name, user?.profile?.last_name].filter(Boolean).join(" ") || user?.email || "";
  const isAdmin = user?.role === "admin"; // Django-админка — только для администраторов

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-100"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {initials(name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold text-ink">{name}</span>
          <span className="block text-xs capitalize text-ink-muted">{user?.role}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-ink-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {isAdmin && (
            <a
              role="menuitem"
              href={DJANGO_ADMIN_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-slate-100"
            >
              <ShieldCheck className="h-4 w-4" /> Admin panel
            </a>
          )}
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
