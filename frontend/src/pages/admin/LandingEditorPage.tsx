import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Eye, ImagePlus, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import london from "../../assets/london.jpg";
import { apiErrorMessage, resolveMediaUrl } from "../../api/client";
import { getLandingForEdit, resetLanding, saveLanding } from "../../api/site";
import { uploadImage } from "../../api/teacher";
import { Button, Card, ErrorBox, Label, Modal, Spinner, inputClass, textareaClass } from "../../components/ui";
import { t, type Lang } from "../../i18n";
import {
  DEFAULT_TEXTS,
  withDefaults,
  type LandingContent,
  type LandingItem,
  type LandingSettings,
  type LandingTexts,
} from "../../lib/landing";
import { LandingView } from "../LandingPage";

type TextKey = Exclude<keyof LandingTexts, "features" | "skills" | "about_points">;
const MAX_POINTS = 6;

/** Перед сохранением: без пустых пунктов списка и пустых строк */
function cleaned(content: LandingContent): LandingContent {
  const clean = (texts: LandingTexts): LandingTexts => {
    const points = texts.about_points?.map((p) => p.trim()).filter(Boolean);
    return { ...texts, about_points: points?.length ? points : undefined };
  };
  return { ...content, en: clean(content.en), ru: clean(content.ru) };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-1.5">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-500" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function LandingEditorPage() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [saved, setSaved] = useState<string>(""); // сохранённое состояние — чтобы знать, есть ли правки
  const [lang, setLang] = useState<Lang>("en");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    getLandingForEdit()
      .then((data) => {
        const c = withDefaults(data);
        setContent(c);
        setSaved(JSON.stringify(cleaned(c)));
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const dirty = !!content && JSON.stringify(cleaned(content)) !== saved;

  // несохранённые правки — предупреждаем при закрытии вкладки
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!content) return error ? <ErrorBox message={error} /> : <Spinner />;

  const texts = content[lang];
  const defaults = DEFAULT_TEXTS[lang];

  function setText(key: TextKey, value: string) {
    setJustSaved(false);
    setContent((c) => c && { ...c, [lang]: { ...c[lang], [key]: value } });
  }
  function setItem(list: "features" | "skills", index: number, field: keyof LandingItem, value: string) {
    setJustSaved(false);
    setContent((c) => {
      if (!c) return c;
      const items = Array.from({ length: 4 }, (_, i) => ({ ...c[lang][list]?.[i] }));
      items[index][field] = value;
      return { ...c, [lang]: { ...c[lang], [list]: items } };
    });
  }
  function setPoints(points: string[] | undefined) {
    setJustSaved(false);
    setContent((c) => c && { ...c, [lang]: { ...c[lang], about_points: points } });
  }
  function setSetting<K extends keyof LandingSettings>(key: K, value: LandingSettings[K]) {
    setJustSaved(false);
    setContent((c) => c && { ...c, settings: { ...c.settings, [key]: value } });
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setError(null);
    try {
      const c = withDefaults(await saveLanding(cleaned(content)));
      setContent(c);
      setSaved(JSON.stringify(cleaned(c)));
      setJustSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setError(null);
    try {
      await resetLanding();
      const c = withDefaults(undefined);
      setContent(c);
      setSaved(JSON.stringify(cleaned(c)));
      setConfirmReset(false);
      setJustSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function uploadHero(file: File) {
    setUploading(true);
    setError(null);
    try {
      setSetting("hero_image_url", await uploadImage(file));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // поле текста: подсказка — стандартный текст на выбранном языке
  const field = (key: TextKey, label: string, opts: { area?: boolean; rows?: number; max: number }) => {
    const id = `landing-${key}`;
    const props = {
      id,
      value: (texts[key] as string | undefined) ?? "",
      onChange: (e: { target: { value: string } }) => setText(key, e.target.value),
      placeholder: defaults[key] as string,
      maxLength: opts.max,
    };
    return (
      <div key={key}>
        <Label htmlFor={id}>{label}</Label>
        {opts.area ? <textarea {...props} rows={opts.rows ?? 3} className={textareaClass} /> : <input {...props} className={inputClass} />}
      </div>
    );
  };

  const items = (list: "features" | "skills", labels: string[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {labels.map((label, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
          <input
            value={texts[list]?.[i]?.title ?? ""}
            onChange={(e) => setItem(list, i, "title", e.target.value)}
            placeholder={defaults[list][i].title}
            aria-label={`${label}: ${t("Title")}`}
            maxLength={60}
            className={inputClass}
          />
          <textarea
            value={texts[list]?.[i]?.text ?? ""}
            onChange={(e) => setItem(list, i, "text", e.target.value)}
            placeholder={defaults[list][i].text}
            aria-label={`${label}: ${t("Text")}`}
            maxLength={300}
            rows={2}
            className={textareaClass}
          />
        </div>
      ))}
    </div>
  );

  const points = texts.about_points;
  const st = content.settings;

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Landing page")}</h1>
          <p className="mt-1 max-w-2xl text-ink-muted">
            {t("The home page guests see before they sign up. Leave a field empty to use the standard text shown in grey.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" /> {t("Reset to standard")}
          </Button>
          <Button variant="secondary" onClick={() => setPreview(true)}>
            <Eye className="h-4 w-4" /> {t("Preview")}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* язык текстов */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="tablist" aria-label={t("Text language")}>
              {(["en", "ru"] as const).map((l) => (
                <button
                  key={l}
                  role="tab"
                  aria-selected={lang === l}
                  onClick={() => setLang(l)}
                  className={`rounded-md px-4 py-1.5 ${lang === l ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
                >
                  {l === "en" ? "English" : "Русский"}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-muted">{t("Visitors see the texts in their interface language.")}</p>
          </div>

          <Section title={t("Hero")} hint={t("The first screen: headline, short description and buttons.")}>
            {field("hero_badge", t("Label above the headline"), { max: 100 })}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("hero_title", t("Headline"), { max: 80 })}
              {field("hero_title_accent", t("Headline, blue line"), { max: 80 })}
            </div>
            {field("hero_subtitle", t("Description"), { area: true, max: 400 })}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("hero_primary", t("Main button"), { max: 40 })}
              {field("hero_secondary", t("Second button"), { max: 40 })}
            </div>
            {field("hero_note", t("Handwritten note (each line on a new line)"), { area: true, rows: 3, max: 120 })}
          </Section>

          <Section title={t("Why BandUp")} hint={t("Four cards about the platform.")}>
            {field("features_eyebrow", t("Small heading"), { max: 60 })}
            {field("features_title", t("Heading"), { max: 120 })}
            {field("features_subtitle", t("Description"), { area: true, max: 400 })}
            {items("features", [1, 2, 3, 4].map((n) => t("Card {n}", { n })))}
          </Section>

          <Section title={t("Four skills")}>
            {field("skills_badge", t("Label"), { max: 60 })}
            {field("skills_title", t("Heading"), { max: 120 })}
            {field("skills_subtitle", t("Description"), { area: true, max: 400 })}
            {field("skills_button", t("Button"), { max: 40 })}
            {items("skills", ["Reading", "Listening", "Writing", "Speaking"])}
          </Section>

          <Section title={t("About us")}>
            {field("about_eyebrow", t("Small heading"), { max: 60 })}
            {field("about_title", t("Heading"), { max: 120 })}
            {field("about_text", t("Text"), { area: true, rows: 5, max: 1200 })}
            <div>
              <Label>{t("List with checkmarks")}</Label>
              {!points ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
                    {defaults.about_points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <Button variant="secondary" className="mt-3 h-9" onClick={() => setPoints([...defaults.about_points])}>
                    {t("Edit list")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {points.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={p}
                        onChange={(e) => setPoints(points.map((x, j) => (j === i ? e.target.value : x)))}
                        aria-label={t("Point {n}", { n: i + 1 })}
                        maxLength={200}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setPoints(points.filter((_, j) => j !== i))}
                        className="rounded-lg px-2 text-ink-muted hover:bg-red-50 hover:text-red-600"
                        aria-label={t("Remove point {n}", { n: i + 1 })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {points.length < MAX_POINTS && (
                      <Button variant="secondary" className="h-9" onClick={() => setPoints([...points, ""])}>
                        <Plus className="h-4 w-4" /> {t("Add point")}
                      </Button>
                    )}
                    <Button variant="ghost" className="h-9" onClick={() => setPoints(undefined)}>
                      {t("Use the standard list")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              {field("contact_title", t("Contact card: heading"), { max: 80 })}
              {field("contact_button", t("Contact card: button"), { max: 40 })}
            </div>
            {field("contact_text", t("Contact card: text"), { area: true, max: 400 })}
          </Section>

          <Section title={t("Call to action")} hint={t("The dark banner at the bottom of the page.")}>
            {field("cta_title", t("Heading"), { max: 120 })}
            {field("cta_text", t("Text"), { area: true, rows: 2, max: 300 })}
            {field("cta_button", t("Button"), { max: 40 })}
          </Section>
        </div>

        {/* настройки — общие для обоих языков */}
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Section title={t("Sections")} hint={t("Same for both languages.")}>
            <Toggle label={t("Numbers on the first screen")} checked={st.show_stats} onChange={(v) => setSetting("show_stats", v)} />
            <Toggle label={t("Why BandUp")} checked={st.show_features} onChange={(v) => setSetting("show_features", v)} />
            <Toggle label={t("Four skills")} checked={st.show_skills} onChange={(v) => setSetting("show_skills", v)} />
            <Toggle label={t("About us")} checked={st.show_about} onChange={(v) => setSetting("show_about", v)} />
            <Toggle label={t("Call to action")} checked={st.show_cta} onChange={(v) => setSetting("show_cta", v)} />
          </Section>

          <Section title={t("First screen photo")}>
            <img
              src={resolveMediaUrl(st.hero_image_url) ?? london}
              alt=""
              className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover"
            />
            <div className="flex flex-wrap gap-2">
              <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {t("Change photo")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadHero(file);
                  }}
                />
              </label>
              {st.hero_image_url && (
                <Button variant="ghost" className="h-9" onClick={() => setSetting("hero_image_url", undefined)}>
                  {t("Use the standard photo")}
                </Button>
              )}
            </div>
          </Section>

          <Section title={t("Telegram")} hint={t("For the “Message us” button. Empty — the link from the site settings.")}>
            <input
              value={st.telegram_url ?? ""}
              onChange={(e) => setSetting("telegram_url", e.target.value || undefined)}
              placeholder="@bandup_uz"
              aria-label={t("Telegram")}
              maxLength={200}
              className={inputClass}
            />
          </Section>
        </div>
      </div>

      {/* панель сохранения внизу экрана */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-8">
          <div className="mr-auto min-w-0 flex-1">
            <ErrorBox message={error} />
          </div>
          {justSaved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {t("Saved — the site is updated")}
            </span>
          )}
          {dirty && <span className="text-sm text-amber-700">{t("Unsaved changes")}</span>}
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save className="h-4 w-4" /> {t("Save changes")}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-amber-50 px-4 py-2.5 sm:px-6">
            <span className="text-sm font-semibold text-amber-800">
              {t("Preview")} · {lang === "en" ? "English" : "Русский"} · {dirty ? t("not saved yet") : t("as on the site")}
            </span>
            <Button variant="secondary" className="h-9" onClick={() => setPreview(false)}>
              <X className="h-4 w-4" /> {t("Close")}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LandingView content={cleaned(content)} language={lang} />
          </div>
        </div>
      )}

      {confirmReset && (
        <Modal title={t("Reset the landing page?")} onClose={() => setConfirmReset(false)}>
          <p className="text-sm text-ink-muted">
            {t("All your texts in both languages, the photo, the Telegram link and the section settings will be replaced with the standard ones.")}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="danger" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> {t("Reset")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
