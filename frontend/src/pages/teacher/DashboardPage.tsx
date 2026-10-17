import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  Scale,
  Target,
  Trophy,
  PenLine,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import castle from "../../assets/hero-castle.jpg";
import { apiErrorMessage } from "../../api/client";
import {
  getDashboard,
  type Activity,
  type SectionType,
  type Stat,
  type TeacherDashboard,
} from "../../api/teacher";
import { Badge, Card, ErrorBox, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { DJANGO_ADMIN_URL } from "../../lib/config";
import { greeting, initials, timeAgo } from "../../lib/format";
import { SECTION_COLORS, SECTION_LABELS } from "../../lib/questionTypes";

// порядок в легенде как на макете
const PERFORMANCE_ORDER: SectionType[] = ["reading", "listening", "writing", "speaking"];

const AVATAR_TINTS = [
  "bg-brand-50 text-brand-700",
  "bg-emerald-50 text-emerald-700",
  "bg-violet-50 text-violet-700",
  "bg-rose-50 text-rose-700",
  "bg-amber-50 text-amber-700",
  "bg-sky-50 text-sky-700",
];

// ───────────────────────── Блоки ─────────────────────────

function Hero({ firstName }: { firstName: string }) {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-white via-white to-brand-50">
      <img
        src={castle}
        alt=""
        className="absolute inset-y-0 right-0 hidden h-full w-[46%] object-cover md:block"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 35%)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 35%)",
        }}
      />
      <div className="relative px-6 py-7 sm:px-8 md:max-w-[58%]">
        <p className="font-semibold text-brand-600">
          {greeting()}, {firstName} 👋
        </p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-ink">
          Here&apos;s what&apos;s happening with your students today.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Track progress, build tests and help your students achieve their IELTS goals.
        </p>
      </div>
      <p className="absolute right-[34%] top-6 hidden -rotate-12 font-hand text-xl leading-tight text-ink lg:block">
        Small steps
        <br />
        make big
        <br />
        progress.
      </p>
    </Card>
  );
}

function Change({ stat, unit, period }: { stat: Stat; unit: "%" | "band"; period: string }) {
  if (stat.change === null || stat.change === 0) {
    return <span className="text-xs text-ink-muted">{stat.change === 0 ? "no change" : "no earlier data"}</span>;
  }
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

function StatCard({
  icon: Icon,
  tint,
  label,
  stat,
  unit,
  note,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  stat: Stat;
  unit: "%" | "band";
  note?: string; // подпись вместо изменения за месяц
}) {
  return (
    <Card className="p-5">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-sm font-medium text-ink">{label}</div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-[32px] font-extrabold leading-none text-ink">{stat.value ?? "—"}</span>
        {note ? <span className="text-xs text-ink-muted">{note}</span> : <Change stat={stat} unit={unit} period="vs last 30 days" />}
      </div>
    </Card>
  );
}

function StudentsTable({ data }: { data: TeacherDashboard }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Student Progress Overview</h2>
        <span className="text-sm text-ink-muted">Latest results</span>
      </div>
      {data.students.length === 0 ? (
        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-ink-muted">
          No results yet. Students appear here after they finish a section.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-ink-muted">
                <th className="rounded-l-lg px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Overall band</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="rounded-r-lg px-4 py-3 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.students.map((s) => {
                const change = s.change === null ? null : Number(s.change);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_TINTS[s.id % AVATAR_TINTS.length]}`}>
                          {initials(s.name)}
                        </span>
                        <Link to={`/teacher/students/${s.id}`} className="font-medium text-ink hover:text-brand-600">
                          {s.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-ink">{s.overall_band}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-2 w-36 overflow-hidden rounded-full bg-slate-100"
                          role="img"
                          aria-label={`Band ${s.overall_band} of 9`}
                        >
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(s.overall_band) / 9) * 100}%` }} />
                        </div>
                        <span
                          className={`w-10 text-xs font-semibold ${
                            change === null ? "text-ink-muted" : change >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                          title="Change since the previous result"
                        >
                          {change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : "±"}${Math.abs(change).toFixed(1)}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink">{s.last_activity}</div>
                      <div className="text-xs text-ink-muted">{timeAgo(s.last_activity_at)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function YourTests({ data }: { data: TeacherDashboard }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Your tests</h2>
        <Link to="/teacher/tests" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {data.tests.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-ink-muted">
          No tests yet.{" "}
          <Link to="/teacher/tests?new=1" className="font-semibold text-brand-600">
            Create the first one
          </Link>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {data.tests.map((t) => (
            <li key={t.id}>
              <Link to={`/teacher/tests/${t.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.is_published ? "bg-emerald-500" : t.problems ? "bg-amber-400" : "bg-brand-500"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{t.title}</div>
                  <div className="text-xs text-ink-muted">
                    {t.questions}/80 questions ·{" "}
                    {t.is_published ? "published" : t.problems ? `${t.problems} thing(s) to finish` : "ready to publish"}
                  </div>
                </div>
                {t.is_published ? <Badge color="green">Live</Badge> : <Badge color="gray">Draft</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PerformanceCard({ data }: { data: TeacherDashboard }) {
  const bySection = Object.fromEntries(data.performance.sections.map((s) => [s.section_type, s]));
  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-ink">Class Performance</h2>
      <div className="mt-4 flex items-end gap-3">
        <span className="text-5xl font-extrabold leading-none text-ink">{data.performance.overall_band ?? "—"}</span>
        <span className="pb-1 text-sm text-ink-muted">average overall band</span>
      </div>
      {/* средние по секциям — отдельные величины по шкале 0–9, поэтому полосы, а не кольцо */}
      <ul className="mt-6 space-y-4">
        {PERFORMANCE_ORDER.map((type) => {
          const s = bySection[type];
          const band = s?.band === null || s?.band === undefined ? null : Number(s.band);
          const tooltip = band === null ? `${SECTION_LABELS[type]}: no results yet` : `${SECTION_LABELS[type]}: ${s.band} average band · ${s.attempts} result${s.attempts === 1 ? "" : "s"}`;
          return (
            <li key={type} className="group relative">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SECTION_COLORS[type] }} aria-hidden />
                  {SECTION_LABELS[type]}
                </span>
                <span className="font-bold text-ink">{s?.band ?? "—"}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100" role="img" aria-label={tooltip}>
                {band !== null && (
                  <div className="h-full rounded-full" style={{ width: `${(band / 9) * 100}%`, background: SECTION_COLORS[type] }} />
                )}
              </div>
              <span className="pointer-events-none absolute -top-8 right-0 z-10 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-white shadow group-hover:block">
                {tooltip}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-ink-muted">Scale 0–9 · all students, all time</p>
    </Card>
  );
}

const ACTIVITY_ICONS: Record<Activity["kind"], { icon: LucideIcon; tint: string }> = {
  joined: { icon: UserPlus, tint: "bg-violet-50 text-violet-600" },
  section_completed: { icon: FileCheck2, tint: "bg-brand-50 text-brand-600" },
  mock_completed: { icon: Trophy, tint: "bg-amber-50 text-amber-600" },
};

function Activities({ data }: { data: TeacherDashboard }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-ink">Recent Activities</h2>
      {data.activities.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {data.activities.map((a, i) => {
            const { icon: Icon, tint } = ACTIVITY_ICONS[a.kind];
            return (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tint}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="text-ink">
                    <span className="font-semibold">{a.student}</span> {a.text}
                  </p>
                  <p className="text-xs text-ink-muted">{timeAgo(a.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function QuickActions() {
  const actions: { label: string; icon: LucideIcon; to?: string; href?: string }[] = [
    { label: "Create test", icon: FilePlus2, to: "/teacher/tests?new=1" },
    { label: "Add student", icon: UserPlus, href: DJANGO_ADMIN_URL + "ielts/user/add/" },
    { label: "Band scales", icon: Scale, href: DJANGO_ADMIN_URL + "ielts/bandconversion/" },
    { label: "Review writing & speaking", icon: PenLine, to: "/teacher/review" },
  ];
  const cls = "flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm font-medium text-ink transition";
  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-ink">Quick Actions</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map(({ label, icon: Icon, to, href }) => {
          const inner = (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                <Icon className="h-5 w-5 text-brand-600" />
              </span>
              {label}
            </>
          );
          if (to) return <Link key={label} to={to} className={`${cls} hover:border-brand-200 hover:bg-brand-50/40`}>{inner}</Link>;
          if (href) return <a key={label} href={href} target="_blank" rel="noreferrer" className={`${cls} hover:border-brand-200 hover:bg-brand-50/40`}>{inner}</a>;
          return (
            <div key={label} className={`${cls} cursor-not-allowed opacity-50`} title="Coming soon">
              {inner}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HelpBanner() {
  return (
    <Card className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-50 to-white p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500">
        <GraduationCap className="h-6 w-6 text-white" />
      </span>
      <div className="min-w-48 flex-1">
        <div className="font-semibold text-ink">Need help with a specific student?</div>
        <div className="text-sm text-ink-muted">See their bands, test history and every answer they gave.</div>
      </div>
      <Link
        to="/teacher/students"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Go to students <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

// ───────────────────────── Страница ─────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const firstName = user?.profile?.first_name || "there";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <Hero firstName={firstName} />
        <ErrorBox message={error} />
        {!data && !error && <Spinner />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
              <StatCard icon={UsersRound} tint="bg-brand-50 text-brand-600" label="Total Students" stat={data.stats.total_students} unit="%" />
              <StatCard icon={ClipboardList} tint="bg-sky-50 text-sky-600" label="Published Tests" stat={data.stats.published_tests} unit="%" note={`${data.stats.draft_tests} draft${data.stats.draft_tests === 1 ? "" : "s"}`} />
              <StatCard icon={FileCheck2} tint="bg-emerald-50 text-emerald-600" label="Tests Completed" stat={data.stats.tests_completed} unit="%" />
              <StatCard icon={Target} tint="bg-violet-50 text-violet-600" label="Average Band Score" stat={data.stats.average_band} unit="band" />
            </div>
            <StudentsTable data={data} />
            <HelpBanner />
          </>
        )}
      </div>
      {data && (
        <div className="space-y-6">
          <YourTests data={data} />
          <PerformanceCard data={data} />
          <Activities data={data} />
          <QuickActions />
        </div>
      )}
    </div>
  );
}
