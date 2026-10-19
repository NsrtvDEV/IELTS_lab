import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FilePlus2,
  FileText,
  Hourglass,
  Mail,
  MapPin,
  PenLine,
  Pencil,
  Phone,
  Save,
  Settings,
  Trash2,
  UserRound,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import london from "../../assets/london.jpg";
import { deleteAvatar, updateProfile, uploadAvatar } from "../../api/auth";
import { apiErrorMessage } from "../../api/client";
import { getTeacherProfile, type TeacherActivity, type TeacherProfileStats } from "../../api/teacher";
import { Avatar } from "../../components/Avatar";
import { Badge, Button, Card, ErrorBox, Label, inputClass, textareaClass } from "../../components/ui";
import type { User } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { t } from "../../i18n";
import { timeAgo } from "../../lib/format";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { PasswordCard } from "../SettingsPage";

const BIO_MAX = 500;
const PHOTO_FADE = {
  maskImage: "linear-gradient(to right, transparent, black 55%), linear-gradient(to bottom, transparent, black 35%)",
  maskComposite: "intersect",
  WebkitMaskImage: "linear-gradient(to right, transparent, black 55%), linear-gradient(to bottom, transparent, black 35%)",
  WebkitMaskComposite: "source-in",
} as const;

function ContactLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-sm text-ink">
      <Icon className="h-4 w-4 shrink-0 text-ink-muted" /> {children}
    </p>
  );
}

// ───────────────────────── Шапка ─────────────────────────

function ProfileHeader({ onEdit }: { onEdit: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  const p = user.profile;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || user.email;
  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-white via-white to-brand-50/70">
      <img src={london} alt="" className="absolute bottom-0 right-0 hidden h-[70%] w-[38%] object-cover opacity-70 md:block" style={PHOTO_FADE} />
      <div className="pointer-events-none absolute right-8 top-24 hidden -rotate-12 lg:block">
        <p className="font-hand text-2xl leading-tight text-brand-600">
          {t("Better English")}
          <br />
          <span className="ml-3">{t("Brighter Future")}</span>
        </p>
        <svg viewBox="0 0 120 40" className="ml-6 mt-1 h-8 w-24 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 34 C 40 34, 80 26, 110 8" />
          <path d="M96 6 L 111 7 L 105 20" />
        </svg>
      </div>

      <div className="relative flex flex-wrap items-start gap-6 p-6 sm:p-8">
        <div className="relative order-1">
          <Avatar name={name} url={p?.avatar_url} className="h-24 w-24 text-3xl shadow-md ring-4 ring-white sm:h-32 sm:w-32 sm:text-4xl" />
          <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 ring-4 ring-white sm:bottom-2 sm:right-2" aria-hidden />
        </div>
        {/* на телефоне текст — отдельной строкой под фото и кнопкой */}
        <div className="order-3 min-w-0 basis-full sm:order-2 sm:basis-auto sm:flex-1 lg:max-w-[46%]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">{name}</h1>
            <Badge color="blue">{user.role === "admin" ? t("Admin") : t("Teacher")}</Badge>
          </div>
          <div className="mt-3 space-y-1.5">
            <ContactLine icon={Mail}>{user.email}</ContactLine>
            {p?.phone && <ContactLine icon={Phone}>{p.phone}</ContactLine>}
            {p?.location && <ContactLine icon={MapPin}>{p.location}</ContactLine>}
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
            {p?.bio || t("Tell your students a little about yourself — add a short bio below.")}
          </p>
        </div>
        <Button variant="secondary" className="order-2 ml-auto self-start bg-white/90 sm:order-3" onClick={onEdit}>
          <Pencil className="h-4 w-4" /> {t("Edit Profile")}
        </Button>
      </div>
    </Card>
  );
}

// ───────────────────────── Личные данные ─────────────────────────

function PhotoField() {
  const { user, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const name = [user.profile?.first_name, user.profile?.last_name].filter(Boolean).join(" ") || user.email;

  async function run(action: () => Promise<User>) {
    setBusy(true);
    setError(null);
    try {
      updateUser(await action());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label>{t("Profile picture")}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} url={user.profile?.avatar_url} className="h-20 w-20 text-2xl" />
        <label
          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100 ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          <Camera className="h-4 w-4" /> {t("Change photo")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) run(() => uploadAvatar(file));
            }}
          />
        </label>
        {user.profile?.avatar_url && (
          <button
            type="button"
            onClick={() => run(deleteAvatar)}
            disabled={busy}
            className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label={t("Remove photo")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t("PNG, JPG or WEBP, up to 2 MB.")}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function PersonalInfo({ firstNameRef }: { firstNameRef: React.RefObject<HTMLInputElement | null> }) {
  const { user, updateUser } = useAuth();
  const p = user?.profile;
  const [firstName, setFirstName] = useState(p?.first_name ?? "");
  const [lastName, setLastName] = useState(p?.last_name ?? "");
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [location, setLocation] = useState(p?.location ?? "");
  const [bio, setBio] = useState(p?.bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!user) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!firstName.trim() || !lastName.trim()) return setError(t("Enter your first and last name."));
    if (phone.trim() && !/^[0-9+()\- ]+$/.test(phone.trim())) return setError(t("The phone number can contain only digits, spaces, +, - and brackets."));
    setSaving(true);
    try {
      updateUser(
        await updateProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          location: location.trim() || null,
          bio: bio.trim() || null,
        })
      );
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <UserRound className="h-5 w-5 text-brand-500" /> {t("Personal Information")}
      </h2>
      <form onSubmit={save} className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="first-name">{t("First name")}</Label>
              <input id="first-name" ref={firstNameRef} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="last-name">{t("Last name")}</Label>
              <input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} maxLength={100} />
            </div>
          </div>
          <div>
            <Label htmlFor="email">{t("Email address")}</Label>
            <input id="email" value={user.email} disabled className={inputClass} />
          </div>
          <div>
            <Label htmlFor="phone">{t("Phone number")}</Label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+998 90 123 45 67"
              maxLength={30}
            />
          </div>
          <div>
            <Label htmlFor="location">{t("Location")}</Label>
            <input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
              placeholder={t("e.g. Tashkent, Uzbekistan")}
              maxLength={100}
            />
          </div>
        </div>

        <div className="space-y-4">
          <PhotoField />
          <div>
            <Label htmlFor="bio">{t("Bio")}</Label>
            <textarea
              id="bio"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={textareaClass}
              placeholder={t("e.g. IELTS trainer with 5+ years of experience.")}
              maxLength={BIO_MAX}
            />
            <p className="mt-1 text-right text-xs text-ink-muted">
              {bio.length}/{BIO_MAX}
            </p>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <ErrorBox message={error} />
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {t("Saved")}
              </span>
            )}
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" /> {t("Save changes")}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

// ───────────────────────── Правая колонка ─────────────────────────

function Statistics({ stats }: { stats: TeacherProfileStats | null }) {
  const tiles: { label: string; value: number | undefined; icon: LucideIcon; tint: string }[] = [
    { label: t("Total Students"), value: stats?.students, icon: UsersRound, tint: "bg-brand-50 text-brand-600" },
    { label: t("Tests Created"), value: stats?.tests_created, icon: FileText, tint: "bg-violet-50 text-violet-600" },
    { label: t("Works Assessed"), value: stats?.works_assessed, icon: ClipboardCheck, tint: "bg-emerald-50 text-emerald-600" },
    { label: t("Waiting for Review"), value: stats?.waiting_review, icon: Hourglass, tint: "bg-rose-50 text-rose-500" },
  ];
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <BarChart3 className="h-5 w-5 text-brand-500" /> {t("Teaching Statistics")}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tint}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-none text-ink">{value ?? "—"}</div>
              <div className="mt-1 text-xs text-ink-muted">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QuickActions() {
  const actions: { label: string; icon: LucideIcon; to: string }[] = [
    { label: t("Create new test"), icon: FilePlus2, to: "/teacher/tests?new=1" },
    { label: t("Review writing & speaking"), icon: PenLine, to: "/teacher/review" },
    { label: t("View my students"), icon: UsersRound, to: "/teacher/students" },
    { label: t("Settings"), icon: Settings, to: "/teacher/settings" },
  ];
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Zap className="h-5 w-5 text-brand-500" /> {t("Quick Actions")}
      </h2>
      <ul className="mt-4 space-y-2">
        {actions.map(({ label, icon: Icon, to }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-ink hover:bg-brand-50">
              <Icon className="h-4 w-4 text-brand-600" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function activityItem(a: TeacherActivity): { text: string; sub: string; to: string; icon: LucideIcon; tint: string } {
  if (a.kind === "test_created") {
    return {
      text: t("Created a new test: {title}", { title: a.title ?? "" }),
      sub: t("Test"),
      to: `/teacher/tests/${a.test_id}`,
      icon: FileText,
      tint: "bg-brand-50 text-brand-600",
    };
  }
  const section = a.section ? SECTION_LABELS[a.section] : "";
  return {
    text: t("Assessed {student}'s {section} — band {band}", { student: a.student ?? "", section, band: a.band ?? "" }),
    sub: section,
    to: `/teacher/review/${a.section}/${a.section_attempt_id}`,
    icon: ClipboardCheck,
    tint: "bg-emerald-50 text-emerald-600",
  };
}

function RecentActivity({ stats }: { stats: TeacherProfileStats | null }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Clock className="h-5 w-5 text-brand-500" /> {t("Recent Activity")}
        </h2>
      </div>
      {stats && stats.activity.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("Create a test or assess a work — your actions will appear here.")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {stats?.activity.map((a, i) => {
            const item = activityItem(a);
            const Icon = item.icon;
            return (
              <li key={i}>
                <Link to={item.to} className="flex items-center gap-3 py-3 hover:opacity-80">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tint}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-ink">{item.text}</p>
                    <p className="text-xs text-ink-muted">{item.sub}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">{timeAgo(a.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ───────────────────────── Страница ─────────────────────────

export function TeacherProfilePage() {
  const [stats, setStats] = useState<TeacherProfileStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTeacherProfile()
      .then(setStats)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  function edit() {
    firstNameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstNameRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <ProfileHeader onEdit={edit} />
        <PersonalInfo firstNameRef={firstNameRef} />
        <PasswordCard />
      </div>
      <div className="space-y-6">
        <ErrorBox message={error} />
        <Statistics stats={stats} />
        <QuickActions />
        <RecentActivity stats={stats} />
      </div>
    </div>
  );
}
