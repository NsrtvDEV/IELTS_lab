import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { updateProfile } from "../../api/auth";
import { apiErrorMessage } from "../../api/client";
import { Button, Card, ErrorBox, Label, inputClass } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../lib/format";

const dateFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const profile = user?.profile;
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [language, setLanguage] = useState(profile?.native_language ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!firstName.trim() || !lastName.trim()) return setError("Enter your first and last name.");
    setSaving(true);
    try {
      updateUser(
        await updateProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          native_language: language.trim() || null,
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
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Profile</h1>
      <Card className="mt-6 flex flex-wrap items-center gap-5 p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-xl font-bold text-white">
          {initials(name)}
        </span>
        <div>
          <div className="text-xl font-bold text-ink">{name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
            <Mail className="h-4 w-4" /> {user.email}
          </div>
          <div className="mt-0.5 text-sm text-ink-muted">Member since {dateFmt.format(new Date(user.created_at))}</div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="first-name">First name</Label>
              <input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="last-name">Last name</Label>
              <input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="language">Native language</Label>
              <input
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={inputClass}
                placeholder="e.g. Uzbek"
                maxLength={50}
              />
            </div>
          </div>
          <ErrorBox message={error} />
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
