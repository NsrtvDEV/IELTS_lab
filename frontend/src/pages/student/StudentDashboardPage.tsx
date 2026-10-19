import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import mountains from "../../assets/mountains.jpg";
import { apiErrorMessage } from "../../api/client";
import { listAttempts, listPublishedTests, type Attempt, type ProgressPoint, type StudentTest } from "../../api/student";
import type { SectionType } from "../../api/teacher";
import { BandChart } from "../../components/BandChart";
import { UnfinishedBanner } from "../../components/UnfinishedBanner";
import { Badge, Card, ErrorBox, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { greeting } from "../../lib/format";
import { SECTION_COLORS, SECTION_LABELS } from "../../lib/questionTypes";
import { SECTION_ICONS, SECTION_TINTS } from "../../lib/sectionStyle";
import {
  SECTIONS,
  overallBand,
  practisedToday,
  recentTests,
  recommendations,
  sectionResults,
  sectionSummaries,
  signed,
  weakestSection,
  type RecentTest,
  type SectionResultItem,
  type SectionSummary,
} from "../../lib/studentStats";
import { locale, t, tn } from "../../i18n";

const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
const DAY = 24 * 60 * 60 * 1000;

function Change({ value, label }: { value: number | null; label?: string }) {
  if (value === null) return label ? <span className="text-xs text-ink-muted">{label}</span> : null;
  if (value === 0) return <span className="text-xs text-ink-muted">{t("no change")}</span>;
  const Arrow = value > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${value > 0 ? "text-emerald-600" : "text-red-600"}`}>
      <Arrow className="h-3.5 w-3.5" /> {signed(value)}
    </span>
  );
}

/** Кольцо прогресса: value от 0 до 1 */
function Ring({ value, size, stroke, color, children }: { value: number; size: number; stroke: number; color: string; children: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ───────────────────────── Блоки ─────────────────────────

function Hero({ firstName, overall, sectionsDone }: { firstName: string; overall: ReturnType<typeof overallBand>; sectionsDone: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-brand-50/40 to-brand-50">
      <img
        src={mountains}
        alt=""
        className="absolute right-0 top-0 hidden h-56 w-[52%] object-cover md:block"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 45%)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 45%)",
        }}
      />
      <div className="relative px-6 pb-6 pt-7 sm:px-8">
        <p className="text-lg text-ink">{greeting()},</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
          {firstName} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 text-ink-muted">{t("Keep going! Every test brings you one step closer to a higher band.")}</p>

        <Card className="mt-6 grid gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <div className="text-sm font-semibold text-ink">{t("Your Current Band Score")}</div>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-5xl font-extrabold tracking-tight text-ink">{overall.band?.toFixed(1) ?? "—"}</span>
              <span className="text-xs leading-tight text-ink-muted">
                <Change value={overall.change} />
                {overall.change !== null && <span className="block">{t("from last result")}</span>}
              </span>
            </div>
            <div className="mt-5 text-sm text-ink-muted">{t("Sections completed")}</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-ink">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> {sectionsDone}
            </div>
          </div>
          <div className="flex justify-center">
            <Ring value={(overall.band ?? 0) / 9} size={160} stroke={14} color="#2f6bff">
              <span className="text-4xl font-extrabold text-ink">{overall.band?.toFixed(1) ?? "—"}</span>
              <span className="text-sm text-ink-muted">{t("Overall Band")}</span>
            </Ring>
          </div>
          <div className="flex h-full items-center justify-between gap-4 rounded-2xl bg-brand-50/70 p-6">
            <p className="font-hand text-2xl leading-snug text-ink">
              “{t("Small steps")}
              <br />
              {t("make big")}
              <br />
              {t("progress.")}”
            </p>
            <TrendingUp className="h-10 w-10 shrink-0 text-brand-500" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionCards({ summary }: { summary: Record<SectionType, SectionSummary> }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {SECTIONS.map((type) => {
        const Icon = SECTION_ICONS[type];
        const tint = SECTION_TINTS[type];
        const s = summary[type];
        return (
          <div key={type} className={`rounded-2xl border p-5 ${tint.card}`}>
            <div className="flex items-start justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tint.icon}`}>
                <Icon className="h-6 w-6" />
              </span>
              <Link
                to={`/practice/${type}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-muted shadow-sm hover:text-ink"
                aria-label={t("{section} tests", { section: SECTION_LABELS[type] })}
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-4 text-lg font-bold text-ink">{SECTION_LABELS[type]}</div>
            <div className="mt-1 text-ink">
              {s.band !== null ? (
                <>
                  <span className="text-2xl font-extrabold">{s.band.toFixed(1)}</span>
                  <span className="text-sm text-ink-muted"> / 9.0</span>
                </>
              ) : (
                <span className="text-sm text-ink-muted">{t("Not taken yet")}</span>
              )}
            </div>
            <div className="mt-1 h-5">
              <Change value={s.change} label={s.count === 1 ? t("first result") : undefined} />
            </div>
            <Link
              to={`/practice/${type}`}
              className={`mt-4 flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm ${tint.button}`}
            >
              {s.band !== null ? t("Continue") : t("Start")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function RecentTestRow({ item }: { item: RecentTest }) {
  const first = item.sections[0];
  const Icon = item.mode === "mock" ? ClipboardList : SECTION_ICONS[first.type];
  const to = item.mode === "mock" ? `/mock/${item.attemptId}` : `/${first.type}/${first.sectionAttemptId}/result`;
  const autoGraded = first.type === "reading" || first.type === "listening";
  return (
    <Link to={to} className="flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-slate-50">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.mode === "mock" ? "bg-brand-50 text-brand-600" : SECTION_TINTS[first.type].icon}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">
          {item.mode === "mock" ? item.title : SECTION_LABELS[first.type]}
        </div>
        <div className="truncate text-xs text-ink-muted">
          {dateFmt.format(new Date(item.date))} · {item.mode === "mock" ? `${t("Mock test")} · ${tn(item.sections.length, "{n} section", "{n} sections")}` : `${t("Practice")} · ${item.title}`}
        </div>
      </div>
      {item.mode === "mock" ? (
        <div className="text-right">
          <div className="text-xs text-ink-muted">{t("Overall")} {item.overall?.toFixed(1) ?? ""}</div>
          <div className="mt-1 flex gap-2 text-xs font-semibold text-ink">
            {item.sections.map((s) => (
              <span key={s.type} className="inline-flex items-center gap-1" title={SECTION_LABELS[s.type]}>
                <span className="h-2 w-2 rounded-full" style={{ background: SECTION_COLORS[s.type] }} />
                {s.band?.toFixed(1) ?? "…"}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 gap-4 text-right">
          <div>
            <div className="text-xs text-ink-muted">{t("Band")}</div>
            <div className="text-sm font-bold text-ink">{first.band?.toFixed(1) ?? <Badge color="amber">{t("Checking")}</Badge>}</div>
          </div>
          {autoGraded && first.raw !== null && (
            <div className="hidden sm:block" title={t("{p}% correct", { p: Math.round((first.raw / 40) * 100) })}>
              <div className="text-xs text-ink-muted">{t("Correct")}</div>
              <div className="text-sm font-semibold text-ink">{first.raw}/40</div>
            </div>
          )}
        </div>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </Link>
  );
}

function RecentTests({ items }: { items: RecentTest[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{t("Recent Tests")}</h2>
        <Link to="/results" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {t("View All")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">{t("Your finished tests will appear here.")}</p>
      ) : (
        <div className="mt-2 divide-y divide-slate-100">
          {items.map((item) => (
            <RecentTestRow key={item.key} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

function MyProgress({ results }: { results: SectionResultItem[] }) {
  const [since] = useState(() => Date.now() - 28 * DAY);
  const series = SECTIONS.map((type) => {
    const points: ProgressPoint[] = results
      .filter((r) => r.type === type && r.band !== null && new Date(r.date).getTime() >= since)
      .map((r) => ({ attempt_id: r.attemptId, section_attempt_id: r.sectionAttemptId, test_title: r.testTitle, band: r.band!.toFixed(1), date: r.date }));
    return [type, points] as [SectionType, ProgressPoint[]];
  }).filter(([, pts]) => pts.length);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{t("My Progress")}</h2>
        <span className="text-sm text-ink-muted">{t("Last 4 weeks")}</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-ink" aria-label={t("Legend")}>
        {SECTIONS.map((type) => (
          <li key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: SECTION_COLORS[type] }} aria-hidden />
            {SECTION_LABELS[type]}
          </li>
        ))}
      </ul>
      {series.length === 0 ? (
        <p className="py-14 text-center text-sm text-ink-muted">{t("No results in the last 4 weeks yet.")}</p>
      ) : (
        <div className="mt-2">
          <BandChart series={series} height={220} yTicks={[0, 3, 6, 9]} />
        </div>
      )}
    </Card>
  );
}

function YourProgress({ summary }: { summary: Record<SectionType, SectionSummary> }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{t("Your Progress")}</h2>
        <Link to="/progress" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {t("View Details")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ul className="mt-4 space-y-5">
        {SECTIONS.map((type) => {
          const Icon = SECTION_ICONS[type];
          const band = summary[type].band;
          return (
            <li key={type} className="flex items-center gap-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${SECTION_TINTS[type].icon}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-ink">{SECTION_LABELS[type]}</span>
                  <span className="font-bold text-ink">{band?.toFixed(1) ?? "—"}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100" role="img" aria-label={t("{section} band {band}", { section: SECTION_LABELS[type], band: band ?? t("not taken") })}>
                  <div className="h-full rounded-full" style={{ width: `${((band ?? 0) / 9) * 100}%`, background: SECTION_COLORS[type] }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DailyGoal({ today, weakest, summary }: { today: Set<SectionType>; weakest: SectionType | null; summary: Record<SectionType, SectionSummary> }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{t("Daily Goal")}</h2>
        {weakest && (
          <Link to={`/practice/${weakest}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
            {t("Practise")} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="mt-4 flex items-center gap-6">
        <Ring value={today.size / 4} size={112} stroke={10} color="#2f6bff">
          <span className="text-2xl font-extrabold text-ink">{today.size}/4</span>
          <span className="text-[11px] text-ink-muted">{t("sections today")}</span>
        </Ring>
        <ul className="space-y-2.5 text-sm">
          {SECTIONS.map((type) => (
            <li key={type} className="flex items-center gap-2">
              {today.has(type) ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label={t("Done")} />
              ) : (
                <Circle className="h-5 w-5 text-slate-300" aria-label={t("Not yet")} />
              )}
              <Link to={`/practice/${type}`} className={today.has(type) ? "text-ink-muted line-through" : "text-ink hover:text-brand-600"}>
                {t("{section} practice", { section: SECTION_LABELS[type] })}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4">
        <Lightbulb className="h-5 w-5 shrink-0 text-brand-500" />
        <div className="text-sm">
          <div className="font-semibold text-ink">{t("Tip")}</div>
          <p className="mt-0.5 text-ink-muted">
            {weakest
              ? t("Focus on {section} — your lowest band ({band}). Improving your weakest skill raises the overall band fastest.", {
                  section: SECTION_LABELS[weakest],
                  band: summary[weakest].band!.toFixed(1),
                })
              : t("Take one test in each section to see your strengths and what to work on.")}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Recommended({ tests, summary }: { tests: StudentTest[]; summary: Record<SectionType, SectionSummary> }) {
  const items = recommendations(tests, summary);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{t("Recommended for You")}</h2>
        <Link to="/tests" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {t("View All")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">{t("No tests are published yet.")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((r) => {
            const Icon = SECTION_ICONS[r.type];
            return (
              <li key={r.type}>
                <Link to={`/practice/${r.type}`} className="flex items-center gap-4 rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${SECTION_TINTS[r.type].icon}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{t("{section} Practice", { section: SECTION_LABELS[r.type] })}</div>
                    <div className="truncate text-xs text-ink-muted">
                      {r.test.title} · {r.reason === "new" ? t("you haven't tried it yet") : t("to raise your band")}
                    </div>
                    <div className="text-xs text-ink-muted">{t("{n} min", { n: r.minutes })}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function StudentDashboardPage() {
  const { user } = useAuth();
  const [tests, setTests] = useState<StudentTest[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPublishedTests(), listAttempts()])
      .then(([t, a]) => {
        setTests(t);
        setAttempts(a);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (!tests) return error ? <ErrorBox message={error} /> : <Spinner />;

  const results = sectionResults(attempts);
  const summary = sectionSummaries(results);
  const overall = overallBand(results);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <UnfinishedBanner attempts={attempts} />
        <Hero firstName={user?.profile?.first_name || t("there")} overall={overall} sectionsDone={results.length} />
        <SectionCards summary={summary} />
        <div className="grid gap-6 2xl:grid-cols-2">
          <RecentTests items={recentTests(attempts, results)} />
          <MyProgress results={results} />
        </div>
      </div>
      <div className="space-y-6">
        <YourProgress summary={summary} />
        <DailyGoal today={practisedToday(results)} weakest={weakestSection(summary)} summary={summary} />
        <Recommended tests={tests} summary={summary} />
      </div>
    </div>
  );
}
