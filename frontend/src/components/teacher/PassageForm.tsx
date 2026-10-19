import { useState, type FormEvent } from "react";
import { FileAudio, Loader2, Trash2, Upload } from "lucide-react";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import {
  createPassage,
  updatePassage,
  uploadAudio,
  type SectionType,
  type TeacherPassage,
} from "../../api/teacher";
import { Button, ErrorBox, Label, inputClass, textareaClass } from "../ui";
import { t, tn } from "../../i18n";

/** Запись части Listening: загрузка файла (или ссылка) и прослушивание */
function AudioField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadAudio(file, setProgress));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <Label>{t("Recording")}</Label>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <FileAudio className="h-5 w-5 shrink-0 text-brand-500" />
          <audio controls preload="metadata" src={resolveMediaUrl(value)} className="h-9 min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-md p-1.5 text-ink-muted hover:bg-slate-100 hover:text-red-600"
            aria-label={t("Remove recording")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-sm text-ink-muted hover:border-brand-300 hover:bg-brand-50/40">
          {progress !== null ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {progress !== null ? t("Uploading… {p}%", { p: progress }) : t("Upload MP3, M4A, WAV or OGG (up to 50 MB)")}
          <input
            type="file"
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={progress !== null}
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {!value && (
        <div className="mt-2">
          {showLink ? (
            <input
              type="url"
              onBlur={(e) => e.target.value.trim() && onChange(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) onChange(v);
                }
              }}
              className={inputClass}
              placeholder={t("https://…/part1.mp3 — direct link to the audio file")}
              aria-label={t("Recording link")}
              autoFocus
            />
          ) : (
            <button type="button" onClick={() => setShowLink(true)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {t("or paste a link instead")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PassageForm({
  sectionId,
  sectionType,
  passage,
  nextPosition,
  onSaved,
  onCancel,
}: {
  sectionId: number;
  sectionType: SectionType;
  passage?: TeacherPassage;
  nextPosition: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const listening = sectionType === "listening";
  const [title, setTitle] = useState(passage?.title ?? "");
  const [text, setText] = useState(passage?.text ?? "");
  const [audioUrl, setAudioUrl] = useState(passage?.audio_url ?? "");
  const [position, setPosition] = useState(String(passage?.position ?? nextPosition));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (listening ? !audioUrl.trim() : !text.trim()) {
      setError(listening ? t("Upload the recording for this part.") : t("Paste the passage text."));
      return;
    }
    const input = {
      title: title.trim() || null,
      text: text.trim() || null,
      audio_url: audioUrl.trim() || null,
      position: Number(position) || 0,
    };
    setSaving(true);
    try {
      if (passage) await updatePassage(passage.id, input);
      else await createPassage(sectionId, input);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <div>
          <Label htmlFor="passage-title">{t("Title")}</Label>
          <input
            id="passage-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder={listening ? t("e.g. Booking a hotel room") : t("e.g. The history of glass")}
            maxLength={255}
          />
        </div>
        <div>
          <Label htmlFor="passage-position">{t("Order")}</Label>
          <input id="passage-position" type="number" min={0} value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </div>
      </div>

      {listening ? (
        <div>
          <AudioField value={audioUrl} onChange={setAudioUrl} />
          <div className="mt-4">
            <Label htmlFor="passage-text">{t("Transcript (optional)")}</Label>
            <textarea id="passage-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} />
            <p className="mt-1.5 text-sm text-ink-muted">{t("Students see it only after they submit — to review their mistakes.")}</p>
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="passage-text">{t("Passage text")}</Label>
          <textarea
            id="passage-text"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${textareaClass} leading-relaxed`}
            placeholder={t("Paste the reading passage here. Use empty lines between paragraphs (A, B, C…).")}
          />
          <p className="mt-1.5 text-sm text-ink-muted">{tn(text.trim() ? text.trim().split(/\s+/).length : 0, "{n} word", "{n} words")}</p>
        </div>
      )}

      <ErrorBox message={error} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button type="submit" loading={saving}>
          {passage ? t("Save") : listening ? t("Add recording") : t("Add passage")}
        </Button>
      </div>
    </form>
  );
}
