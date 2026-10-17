import { useState, type FormEvent } from "react";
import { apiErrorMessage } from "../../api/client";
import {
  createPassage,
  updatePassage,
  type SectionType,
  type TeacherPassage,
} from "../../api/teacher";
import { Button, ErrorBox, Label, inputClass, textareaClass } from "../ui";

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
      setError(listening ? "Add a link to the recording." : "Paste the passage text.");
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
          <Label htmlFor="passage-title">Title</Label>
          <input
            id="passage-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder={listening ? "e.g. Booking a hotel room" : "e.g. The history of glass"}
            maxLength={255}
          />
        </div>
        <div>
          <Label htmlFor="passage-position">Order</Label>
          <input id="passage-position" type="number" min={0} value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </div>
      </div>

      {listening ? (
        <div>
          <Label htmlFor="passage-audio">Recording URL</Label>
          <input
            id="passage-audio"
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            className={inputClass}
            placeholder="https://…/part1.mp3"
          />
          <p className="mt-1.5 text-sm text-ink-muted">File upload will come together with the Listening section.</p>
          <div className="mt-4">
            <Label htmlFor="passage-text">Transcript (optional)</Label>
            <textarea id="passage-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="passage-text">Passage text</Label>
          <textarea
            id="passage-text"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${textareaClass} leading-relaxed`}
            placeholder="Paste the reading passage here. Use empty lines between paragraphs (A, B, C…)."
          />
          <p className="mt-1.5 text-sm text-ink-muted">{text.trim() ? text.trim().split(/\s+/).length : 0} words</p>
        </div>
      )}

      <ErrorBox message={error} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {passage ? "Save" : listening ? "Add recording" : "Add passage"}
        </Button>
      </div>
    </form>
  );
}
