import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Mic, PenLine } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { listReview, type ReviewItem } from "../../api/teacher";
import { Badge, Button, Card, ErrorBox, Spinner } from "../../components/ui";
import { initials, timeAgo } from "../../lib/format";
import { t, tn } from "../../i18n";

type Tab = "pending" | "assessed";

export function ReviewQueuePage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<Record<Tab, ReviewItem[] | null>>({ pending: null, assessed: null });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listReview("pending"), listReview("assessed")])
      .then(([pending, assessed]) => setItems({ pending, assessed }))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const list = items[tab];

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t("Review")}</h1>
      <p className="mt-1 text-ink-muted">{t("Writing and Speaking works waiting for your assessment — the oldest first.")}</p>

      <div className="mt-6 flex rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:inline-flex" role="tablist">
        {(["pending", "assessed"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-4 py-1.5 ${tab === key ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
          >
            {key === "pending" ? t("To assess") : t("Assessed")}
            {items[key] && <span className="ml-1.5 text-ink-muted">{items[key]!.length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <ErrorBox message={error} />
        {!list && !error && <Spinner />}
        {list && list.length === 0 && (
          <Card className="flex flex-col items-center px-6 py-14 text-center text-ink-muted">
            {tab === "pending" ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <PenLine className="h-8 w-8" />}
            <p className="mt-3">{tab === "pending" ? t("All caught up — nothing to assess.") : t("No assessed works yet.")}</p>
          </Card>
        )}
        {list && list.length > 0 && (
          <Card className="divide-y divide-slate-100">
            {list.map((item) => (
              <div key={item.section_attempt_id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {initials(item.student_name)}
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                    {item.section_type === "speaking" ? <Mic className="h-3 w-3 text-brand-600" /> : <PenLine className="h-3 w-3 text-brand-600" />}
                  </span>
                </span>
                <div className="min-w-48 flex-1">
                  <div className="font-semibold text-ink">{item.student_name}</div>
                  <div className="text-sm text-ink-muted">
                    {item.section_type === "speaking" ? "Speaking" : "Writing"} · {item.test_title}
                    {item.mode === "mock" && ` (${t("full mock")})`} · {t("submitted {when}", { when: timeAgo(item.submitted_at) })}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  {item.section_type === "speaking" ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-ink-muted">
                      {t("{n} of {total} answered", { n: item.answered ?? 0, total: item.questions ?? 0 })}
                    </span>
                  ) : (
                    item.word_counts.map((w, i) => (
                      <span key={i} className="rounded-md bg-slate-100 px-2 py-1 text-ink-muted">
                        {t("Task {n}", { n: i + 1 })}: <span className="font-semibold text-ink">{tn(w, "{n} word", "{n} words")}</span>
                      </span>
                    ))
                  )}
                </div>
                {item.band_score && <Badge color="green">{t("Band")} {item.band_score}</Badge>}
                <Link to={`/teacher/review/${item.section_type}/${item.section_attempt_id}`}>
                  <Button variant={tab === "pending" ? "primary" : "secondary"} className="h-9">
                    {tab === "pending" ? t("Assess") : t("View")}
                  </Button>
                </Link>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
