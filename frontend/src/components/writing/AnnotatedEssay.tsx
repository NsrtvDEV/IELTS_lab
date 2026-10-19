import { useRef, useState, type ReactNode } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { InlineComment } from "../../api/student";
import { Button, textareaClass } from "../ui";
import { t } from "../../i18n";

/** Позиции выделения внутри контейнера — в символах текста (номера комментариев в ::after в текст не входят) */
function selectionIn(container: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(container);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

/** Эссе с подсвеченными фрагментами и комментариями; editable — учитель выделяет текст и пишет комментарий */
export function AnnotatedEssay({
  text,
  comments,
  onChange,
}: {
  text: string;
  comments: InlineComment[];
  onChange?: (comments: InlineComment[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pending, setPending] = useState<{ start: number; end: number } | null>(null);
  const [note, setNote] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const sorted = [...comments].sort((a, b) => a.start - b.start);

  function onMouseUp() {
    if (!onChange || !box.current) return;
    const sel = selectionIn(box.current);
    if (!sel) return;
    let { start, end } = sel;
    while (start < end && /\s/.test(text[start])) start++; // без пробелов по краям
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (start >= end) return;
    if (sorted.some((c) => c.start < end && start < c.end)) {
      setHint(t("This fragment overlaps an existing comment — select another one."));
      return;
    }
    setHint(null);
    setPending({ start, end });
    setNote("");
  }

  function add() {
    if (!pending || !note.trim() || !onChange) return;
    onChange([...sorted, { ...pending, quote: text.slice(pending.start, pending.end), text: note.trim() }]);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  function show(i: number) {
    setActive(i);
    box.current?.querySelector(`[data-n="${i + 1}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // текст кусками: обычный и подсвеченный с номером комментария
  const parts: ReactNode[] = [];
  let pos = 0;
  sorted.forEach((c, i) => {
    if (c.start > pos) parts.push(text.slice(pos, c.start));
    parts.push(
      <mark
        key={i}
        data-n={i + 1}
        onClick={() => setActive(i)}
        className={`cursor-pointer rounded-sm px-0.5 text-ink after:ml-0.5 after:align-super after:text-[10px] after:font-bold after:text-amber-700 after:content-[attr(data-n)] ${
          active === i ? "bg-amber-300" : "bg-amber-100 hover:bg-amber-200"
        }`}
      >
        {text.slice(c.start, c.end)}
      </mark>
    );
    pos = c.end;
  });
  parts.push(text.slice(pos));

  return (
    <div>
      {onChange && (
        <p className="mb-2 text-xs text-ink-muted">{t("Select a word or phrase in the essay to comment on it.")}</p>
      )}
      <div
        ref={box}
        onMouseUp={onMouseUp}
        className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-7 text-ink"
      >
        {parts}
      </div>
      {hint && <p className="mt-2 text-sm text-amber-700">{hint}</p>}

      {pending && onChange && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">{t("Comment on:")}</span>{" "}
            <span className="rounded-sm bg-amber-100 px-1">“{text.slice(pending.start, pending.end)}”</span>
          </p>
          <textarea
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${textareaClass} mt-2`}
            placeholder={t("e.g. Wrong word: “there”, not “their”.")}
            aria-label={t("Comment")}
            maxLength={2000}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" className="h-9" onClick={() => setPending(null)}>
              {t("Cancel")}
            </Button>
            <Button className="h-9" onClick={add} disabled={!note.trim()}>
              <MessageSquarePlus className="h-4 w-4" /> {t("Add comment")}
            </Button>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <ol className="mt-3 space-y-2">
          {sorted.map((c, i) => (
            <li
              key={`${c.start}-${c.end}`}
              className={`flex gap-3 rounded-lg border px-3 py-2 text-sm ${active === i ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
            >
              <button
                onClick={() => show(i)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-800"
                aria-label={t("Show fragment {n}", { n: i + 1 })}
              >
                {i + 1}
              </button>
              <button onClick={() => show(i)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs text-ink-muted">“{c.quote}”</span>
                <span className="block text-ink">{c.text}</span>
              </button>
              {onChange && (
                <button
                  onClick={() => onChange(sorted.filter((_, j) => j !== i))}
                  className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50"
                  aria-label={t("Delete comment {n}", { n: i + 1 })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
