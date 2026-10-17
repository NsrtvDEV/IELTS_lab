import { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import { uploadImage } from "../../api/teacher";
import { Label } from "../ui";

/** Картинка к группе: схема, карта, таблица, flow-chart */
export function ImageField({
  value,
  onChange,
  hint = "A diagram, map, table or flow-chart the questions refer to.",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label>Image (optional)</Label>
      <p className="mb-2 text-sm text-ink-muted">{hint}</p>
      {value ? (
        <div className="relative inline-block">
          <img src={resolveMediaUrl(value)} alt="Question group" className="max-h-56 rounded-lg border border-slate-200" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-ink-muted shadow hover:text-red-600"
            aria-label="Remove image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-sm text-ink-muted hover:border-brand-300 hover:bg-brand-50/40">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {uploading ? "Uploading…" : "Upload PNG, JPG, WEBP or SVG (up to 5 MB)"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={uploading}
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

