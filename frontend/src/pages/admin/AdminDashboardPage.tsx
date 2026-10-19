import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  FilePlus2,
  FileText,
  GraduationCap,
  ShieldCheck,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import mountains from "../../assets/mountains.jpg";
import { getAdminDashboard, getUserGrowth, type AdminActivity, type AdminDashboard, type GrowthPoint } from "../../api/admin";
import { apiErrorMessage } from "../../api/client";
import type { Stat } from "../../api/teacher";
import { Avatar } from "../../components/Avatar";
import { GrowthChart } from "../../components/admin/GrowthChart";
import { RoleDonut } from "../../components/admin/RoleDonut";
import { Badge, Card, ErrorBox, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { locale, t, tn } from "../../i18n";
import { DJANGO_ADMIN_URL } from "../../lib/config";
import { timeAgo } from "../../lib/format";
import { SECTION_COLORS, SECTION_LABELS } from "../../lib/questionTypes";
import { ROLE_LABELS } from "../../lib/roles";
import { SECTION_ICONS, SECTION_TINTS } from "../../lib/sectionStyle";

const PERIODS = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "3M" },
  { days: 180, label: "6M" },
] as const;
const numberFmt = new Intl.NumberFormat(locale);
const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

// ───────────────────────── Карточки ─────────────────────────

function Change({ stat, unit, period }: { stat: Stat; unit: "%" | "band"; period: string }) {
  if (stat.change === null) return <span className="text-xs text-ink-muted">{t("no earlier data")}</span>;
  if (stat.change === 0) return <span className="text-xs text-ink-muted">{t("no change")} · {period}</span>;
  const up = stat.change > 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  const value = unit === "%" ? `${Math.abs(stat.change)}%` : Math.abs(stat.change).toFixed(1);
  return (
    <span className="text-xs leading-tight">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
        <Arrow className="h-3.5 w-3.5" /> {value}
      </span>
      <span className="block text-ink-muted">{period}</span>
    </span>
  );
}

function StatCard({ icon: Icon, tint, label, stat, unit, period }: { icon: LucideIcon; tint: string; label: string; stat: Stat; unit: "%" | "band"; period: string }) {
  const value = stat.value === null ? "—" : unit === "%" ? numberFmt.format(Number(stat.value)) : stat.value;
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tint}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-[28px] font-extrabold leading-none text-ink">{value}</span>
          <Change stat={stat} unit={unit} period={period} />
        </div>
      </div>
    </Card>
  );
}

function CardHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="min-w-0 text-lg font-bold leading-snug text-ink">{title}</h2>
      {to && (
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-600 hover:text-brand-700">
          {t("View all")} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// ───────────────────────── События ─────────────────────────

function activityView(a: AdminActivity): { icon: LucideIcon; tint: string; title: string; detail: string } {
  if (a.kind === "user_joined") {
    return { icon: UserPlus, tint: "bg-brand-50 text-brand-600", title: t("New user registered"), detail: a.user_name ?? "" };
  }
  if (a.kind === "test_created") {
    return {
      icon: FilePlus2,
      tint: "bg-emerald-50 text-emerald-600",
      title: t("New test created"),
      detail: a.user_name ? `${a.test_title} · ${a.user_name}` : (a.test_title ?? ""),
    };
  }
  const section = a.section ? SECTION_LABELS[a.section] : "";
  return {
    icon: FileText,
    tint: "bg-violet-50 text-violet-600",
    title: t("Section completed"),
    detail: `${a.user_name} — ${section} · ${a.test_title}${a.band ? ` · ${t("band {band}", { band: a.band })}` : ""}`,
  };
}

function Activity({ items }: { items: AdminActivity[] }) {
  return (
    <Card className="p-5">
      <CardHeader title={t("Recent Activity")} />
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("Nothing yet.")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((a, i) => {
            const v = activityView(a);
            const Icon = v.icon;
            return (
              <li key={i} className="flex gap-3 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${v.tint}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink">{v.title}</p>
                  <p className="line-clamp-2 text-ink-muted">{v.detail}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{timeAgo(a.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ───────────────────────── Страница ─────────────────────────

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [days, setDays] = useState<number>(30);
  const [growth, setGrowth] = useState<GrowthPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    getUserGrowth(days)
      .then(setGrowth)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [days]);

  const firstName = user?.profile?.first_name || t("there");
  const maxSkill = Math.max(1, ...(data?.skills.map((s) => s.attempts) ?? [1]));
  const growthFrom = growth?.[0];
  const growthTo = growth?.[growth.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Dashboard")}</h1>
          <p className="mt-1 text-ink-muted">{t("Welcome back, {name}! Here's what's happening on your platform.", { name: firstName })}</p>
        </div>
        {/* период — для графика роста (фильтры над графиками, а не внутри) */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm font-semibold" role="radiogroup" aria-label={t("Period")}>
          {PERIODS.map((p) => (
            <button
              key={p.days}
              role="radio"
              aria-checked={days === p.days}
              onClick={() => setDays(p.days)}
              className={`rounded-md px-3 py-1.5 ${days === p.days ? "bg-brand-500 text-white" : "text-ink-muted hover:text-ink"}`}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      <ErrorBox message={error} />
      {!data && !error && <Spinner />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={UsersRound} tint="bg-brand-50 text-brand-600" label={t("Total Users")} stat={data.total_users} unit="%" period={t("vs last week")} />
            <StatCard icon={GraduationCap} tint="bg-emerald-50 text-emerald-600" label={t("Total Teachers")} stat={data.total_teachers} unit="%" period={t("vs last week")} />
            <StatCard icon={FileText} tint="bg-violet-50 text-violet-600" label={t("Total Tests")} stat={data.total_tests} unit="%" period={t("vs last week")} />
            <StatCard icon={BarChart3} tint="bg-sky-50 text-sky-600" label={t("Average Band Score")} stat={data.average_band} unit="band" period={t("vs last month")} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5 lg:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">{t("User Growth")}</h2>
                {growthFrom && growthTo && (
                  <span className="text-sm text-ink-muted">
                    {dateFmt.format(new Date(growthFrom.date))} – {dateFmt.format(new Date(growthTo.date))} ·{" "}
                    <span className="font-semibold text-ink">+{numberFmt.format(growthTo.users - growthFrom.users)}</span>
                  </span>
                )}
              </div>
              <div className={`mt-4 transition-opacity ${growth ? "" : "opacity-40"}`}>
                {growth ? <GrowthChart points={growth} height={300} /> : <div className="h-[300px]" />}
              </div>
            </Card>

            <Card className="p-5">
              <CardHeader title={t("Users by Role")} />
              <div className="mt-5">
                <RoleDonut roles={data.roles} />
              </div>
              {data.blocked_users > 0 && (
                <p className="mt-4 text-center text-xs text-ink-muted">
                  {tn(data.blocked_users, "{n} blocked user", "{n} blocked users")}
                </p>
              )}
            </Card>

            <div className="lg:col-span-2 xl:col-span-1 xl:row-span-2">
              <Activity items={data.activity} />
            </div>

            <Card className="p-5">
              <CardHeader title={t("Top Performing Tests")} to="/teacher/tests" />
              {data.top_tests.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">{t("No results yet.")}</p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-muted">
                      <th className="w-8 pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">{t("Test")}</th>
                      <th className="pb-2 text-right font-medium" title={t("Average band")}>{t("Band")}</th>
                      <th className="pb-2 pl-3 text-right font-medium">{t("Attempts")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.top_tests.map((tt, i) => (
                      <tr key={tt.id}>
                        <td className="py-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                        </td>
                        <td className="py-2.5 pr-2">
                          <Link to={`/teacher/tests/${tt.id}`} className="line-clamp-2 font-medium text-ink hover:text-brand-600">
                            {tt.title}
                          </Link>
                        </td>
                        <td className="py-2.5 text-right font-bold text-ink">{tt.average_band}</td>
                        <td className="py-2.5 pl-3 text-right text-ink-muted">{numberFmt.format(tt.attempts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="p-5">
              <CardHeader title={t("Popular Skills")} />
              {data.skills.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">{t("No results yet.")}</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {data.skills.map((s) => {
                    const Icon = SECTION_ICONS[s.section];
                    return (
                      <li key={s.section} className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${SECTION_TINTS[s.section].icon}`}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-ink">{SECTION_LABELS[s.section]}</span>
                            <span className="text-ink-muted">{tn(s.attempts, "{n} attempt", "{n} attempts")}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" aria-hidden>
                            <div className="h-full rounded-full" style={{ width: `${(s.attempts / maxSkill) * 100}%`, background: SECTION_COLORS[s.section] }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5 lg:col-span-2 xl:col-span-1">
              <CardHeader title={t("Recent Users")} to="/admin/users" />
              <ul className="mt-3 divide-y divide-slate-100">
                {data.recent_users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={u.name} url={u.avatar_url} className="h-9 w-9 text-xs" fallback="bg-brand-50 text-brand-700" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{u.name}</div>
                      <div className="text-xs text-ink-muted">{timeAgo(u.joined_at)}</div>
                    </div>
                    <Badge color={u.role === "student" ? "blue" : u.role === "teacher" ? "green" : "gray"}>{t(ROLE_LABELS[u.role])}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="relative flex flex-wrap items-center gap-5 overflow-hidden bg-gradient-to-r from-brand-50 to-white p-6">
            <img
              src={mountains}
              alt=""
              className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-1/3 object-cover opacity-60 md:block"
              style={{ maskImage: "linear-gradient(to right, transparent, black 60%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 60%)" }}
            />
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500 shadow-md shadow-brand-500/30">
              <ShieldCheck className="h-7 w-7 text-white" />
            </span>
            <div className="relative min-w-60 flex-1">
              <div className="text-lg font-bold text-ink">{t("Keep the platform safe and secure")}</div>
              <div className="text-sm text-ink-muted">
                {t("Manage roles and access, block accounts and edit any data in the admin panel.")}
              </div>
            </div>
            <a
              href={DJANGO_ADMIN_URL}
              target="_blank"
              rel="noreferrer"
              className="relative inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              {t("Open admin panel")} <ArrowRight className="h-4 w-4" />
            </a>
          </Card>
        </>
      )}
    </div>
  );
}
