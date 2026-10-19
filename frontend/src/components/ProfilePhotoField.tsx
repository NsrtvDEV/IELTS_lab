import { useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { deleteAvatar, uploadAvatar } from "../api/auth";
import { apiErrorMessage } from "../api/client";
import type { User } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n";
import { Avatar } from "./Avatar";
import { Label } from "./ui";

/** Фото профиля: загрузка (PNG, JPG, WEBP до 2 МБ) и удаление — сохраняется сразу */
export function ProfilePhotoField() {
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
