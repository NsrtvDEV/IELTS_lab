import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail, Phone } from "lucide-react";
import { updateProfile } from "../../api/auth";
import { apiErrorMessage } from "../../api/client";
import { Avatar } from "../../components/Avatar";
import { ProfilePhotoField } from "../../components/ProfilePhotoField";
import { Button, Card, ErrorBox, Label, inputClass } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { locale, t } from "../../i18n";

const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const profile = user?.profile;
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [language, setLanguage] = useState(profile?.native_language ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!firstName.trim() || !lastName.trim()) return setError(t("Enter your first and last name."));
    if (phone.trim() && !/^[0-9+()\- ]+$/.test(phone.trim()))
      return setError(t("The phone number can contain only digits, spaces, +, - and brackets."));
    setSaving(true);
    try {
      updateUser(
        await updateProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          native_language: language.trim() || null,
          phone: phone.trim() || null,
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
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Profile")}</h1>
      <Card className="mt-6 flex flex-wrap items-center gap-5 p-6">
        <Avatar name={name} url={profile?.avatar_url} className="h-16 w-16 text-xl" />
        <div>
          <div className="text-xl font-bold text-ink">{name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
            <Mail className="h-4 w-4" /> {user.email}
          </div>
          {profile?.phone && (
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
              <Phone className="h-4 w-4" /> {profile.phone}
            </div>
          )}
          <div className="mt-0.5 text-sm text-ink-muted">{t("Member since {date}", { date: dateFmt.format(new Date(user.created_at)) })}</div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <ProfilePhotoField />
        <form onSubmit={save} className="mt-6 space-y-5 border-t border-slate-100 pt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="first-name">{t("First name")}</Label>
              <input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="last-name">{t("Last name")}</Label>
              <input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="language">{t("Native language")}</Label>
              <input
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={inputClass}
                placeholder={t("e.g. Uzbek")}
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="phone">
                {t("Phone number")} <span className="font-normal text-ink-muted">({t("optional")})</span>
              </Label>
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
          </div>
          <ErrorBox message={error} />
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {t("Saved")}
              </span>
            )}
            <Button type="submit" loading={saving}>
              {t("Save changes")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
