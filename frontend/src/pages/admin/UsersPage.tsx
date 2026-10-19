import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Ban, Search, ShieldCheck, UsersRound } from "lucide-react";
import { listUsers, updateUser, type AdminUser } from "../../api/admin";
import { apiErrorMessage } from "../../api/client";
import type { UserRole } from "../../api/types";
import { Avatar } from "../../components/Avatar";
import { Badge, Button, Card, ErrorBox, Modal, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { locale, t } from "../../i18n";
import { ROLE_LABELS, ROLE_ORDER, ROLE_PLURAL } from "../../lib/roles";

type Filter = "all" | UserRole | "blocked";
const FILTERS: Filter[] = ["all", ...ROLE_ORDER, "blocked"];
const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

/** Администратор: все пользователи — роль и блокировка */
export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<AdminUser | null>(null); // блокировка — с подтверждением
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback((q: string, f: Filter) => {
    listUsers({
      q: q.trim() || undefined,
      role: f !== "all" && f !== "blocked" ? f : undefined,
      blocked: f === "blocked" ? true : undefined,
    })
      .then((list) => {
        setUsers(list);
        setError(null);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => load("", filter), [load, filter]);

  function search(e: FormEvent) {
    e.preventDefault();
    load(query, filter);
  }

  async function change(u: AdminUser, changes: { role?: UserRole; is_active?: boolean }) {
    setBusy(u.id);
    setError(null);
    try {
      const updated = await updateUser(u.id, changes);
      setUsers((list) => list && list.map((x) => (x.id === u.id ? updated : x)));
      setConfirm(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Users")}</h1>
          <p className="mt-1 text-ink-muted">{t("Change roles and block accounts. A blocked user is signed out at once and can't log in.")}</p>
        </div>
        <form onSubmit={search} className="relative w-full max-w-xs" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Name or email…")}
            aria-label={t("Search users")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:inline-flex" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-1.5 ${filter === f ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
          >
            {f === "all" ? t("All") : f === "blocked" ? t("Blocked users") : t(ROLE_PLURAL[f])}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        <ErrorBox message={error} />
        {!users && !error && <Spinner />}
        {users && users.length === 0 && (
          <Card className="flex flex-col items-center px-6 py-14 text-center text-ink-muted">
            <UsersRound className="h-8 w-8" />
            <p className="mt-3">{t("No users found.")}</p>
          </Card>
        )}
        {users && users.length > 0 && (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">{t("User")}</th>
                  <th className="px-5 py-3 font-medium">{t("Role")}</th>
                  <th className="px-5 py-3 font-medium">{t("Status")}</th>
                  <th className="px-5 py-3 font-medium">{t("Joined")}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className={u.is_active ? "" : "bg-slate-50/70"}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} url={u.avatar_url} className="h-9 w-9 text-xs" fallback="bg-brand-50 text-brand-700" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">
                              {u.name}
                              {self && <span className="ml-1.5 text-xs font-normal text-ink-muted">({t("you")})</span>}
                            </span>
                            <span className="block text-xs text-ink-muted">{u.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={u.role}
                          disabled={self || busy === u.id}
                          onChange={(e) => change(u, { role: e.target.value as UserRole })}
                          aria-label={t("Role of {name}", { name: u.name })}
                          title={self ? t("You can't change your own role") : undefined}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-ink-muted"
                        >
                          {ROLE_ORDER.map((r) => (
                            <option key={r} value={r}>
                              {t(ROLE_LABELS[r])}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        {u.is_active ? <Badge color="green">{t("Active")}</Badge> : <Badge color="amber">{t("Blocked")}</Badge>}
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{dateFmt.format(new Date(u.joined_at))}</td>
                      <td className="px-5 py-3 text-right">
                        {!self &&
                          (u.is_active ? (
                            <Button variant="danger" className="h-9" onClick={() => setConfirm(u)} disabled={busy === u.id}>
                              <Ban className="h-4 w-4" /> {t("Block")}
                            </Button>
                          ) : (
                            <Button variant="secondary" className="h-9" onClick={() => change(u, { is_active: true })} loading={busy === u.id}>
                              <ShieldCheck className="h-4 w-4" /> {t("Unblock")}
                            </Button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {confirm && (
        <Modal title={t("Block {name}?", { name: confirm.name })} onClose={() => setConfirm(null)}>
          <p className="text-sm text-ink-muted">
            {t("They will be signed out on all devices and won't be able to log in until you unblock them. Their results are kept.")}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {t("Cancel")}
            </Button>
            <Button variant="danger" onClick={() => change(confirm, { is_active: false })} loading={busy === confirm.id}>
              <Ban className="h-4 w-4" /> {t("Block")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
