import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ClipboardCheck, Clock, Hourglass, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationKind,
  type NotificationList,
} from "../api/notifications";
import { timeAgo } from "../lib/format";

const POLL_MS = 30_000;

const KIND_ICONS: Record<NotificationKind, { icon: LucideIcon; tint: string }> = {
  assessed: { icon: Trophy, tint: "bg-emerald-50 text-emerald-600" },
  auto_submitted: { icon: Clock, tint: "bg-amber-50 text-amber-600" },
  test_published: { icon: Sparkles, tint: "bg-brand-50 text-brand-600" },
  review_submitted: { icon: ClipboardCheck, tint: "bg-violet-50 text-violet-600" },
  review_waiting: { icon: Hourglass, tint: "bg-rose-50 text-rose-500" },
};

/** Колокольчик: счётчик непрочитанных и список; новые подтягиваются раз в 30 секунд */
export function NotificationBell() {
  const navigate = useNavigate();
  const [data, setData] = useState<NotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    listNotifications()
      .then(setData)
      .catch(() => undefined); // колокольчик не должен мешать работе страницы
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function toggle() {
    if (!open) load(); // свежий список при открытии
    setOpen(!open);
  }

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.read) {
      setData((d) => d && { unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) });
      markNotificationRead(n.id).catch(() => undefined);
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    setData((d) => d && { unread: 0, items: d.items.map((x) => ({ ...x, read: true })) });
    await markAllNotificationsRead().catch(() => undefined);
  }

  const unread = data?.unread ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative rounded-xl p-2.5 text-ink-muted hover:bg-slate-100"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#f7f9fd]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-bold text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                <CheckCheck className="h-4 w-4" /> Mark all as read
              </button>
            )}
          </div>
          {!data ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">Loading…</p>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center text-sm text-ink-muted">
              <Bell className="h-7 w-7 text-slate-300" />
              <p className="mt-2">No notifications yet.</p>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {data.items.map((n) => {
                const { icon: Icon, tint } = KIND_ICONS[n.kind] ?? KIND_ICONS.test_published;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? "" : "bg-brand-50/40"}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read ? "text-ink-muted" : "font-semibold text-ink"}`}>{n.text}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
