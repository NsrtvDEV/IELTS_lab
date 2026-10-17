import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { SectionResult } from "../../api/student";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { Card } from "../ui";

function minutes(sec: number | null) {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  return `${m} min ${String(sec % 60).padStart(2, "0")} s`;
}

/** Разбор сданной секции с вопросами: счёт, band и ответы по каждому вопросу */
export function ResultView({
  result,
  backTo,
  backLabel,
  heading,
}: {
  result: SectionResult;
  backTo: string;
  backLabel: string;
  heading?: string; // например, имя ученика в кабинете учителя
}) {
  const [onlyWrong, setOnlyWrong] = useState(false);

  const percent = result.question_count ? Math.round((result.correct_count / result.question_count) * 100) : 0;
  const wrong = result.question_count - result.correct_count;
  const shown = onlyWrong ? result.questions.filter((q) => q.earned < q.points) : result.questions;

  return (
    <>
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <Card className="mt-4 overflow-hidden">
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <p className="font-semibold text-brand-600">
              {heading ? `${heading} · ` : ""}
              {SECTION_LABELS[result.section_type]} · {result.test_title}
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              {result.correct_count} <span className="text-2xl font-bold text-ink-muted sm:text-3xl">/ {result.question_count} correct</span>
            </h1>
            <div className="mt-4 h-2.5 max-w-md overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${percent}% correct`}>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {result.correct_count} correct
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" /> {wrong} wrong or unanswered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {minutes(result.time_spent_sec)}
              </span>
              {result.raw_score !== null && result.max_score !== result.question_count && (
                <span>
                  Score {result.raw_score}/{result.max_score} points
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-brand-50 px-8 py-5">
            <span className="text-sm font-medium text-brand-700">Band score</span>
            <span className="text-5xl font-extrabold text-brand-600">{result.band_score ?? "—"}</span>
          </div>
        </div>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Answers</h2>
        <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {[
            ["All", false],
            [`Wrong (${wrong})`, true],
          ].map(([label, value]) => (
            <button
              key={String(label)}
              onClick={() => setOnlyWrong(value as boolean)}
              aria-pressed={onlyWrong === value}
              className={`rounded-md px-3 py-1.5 ${onlyWrong === value ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-ink-muted">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">Your answer</th>
              <th className="px-5 py-3 font-medium">Correct answer</th>
              <th className="px-5 py-3 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((q) => {
              const ok = q.earned === q.points;
              const partial = !ok && q.earned > 0;
              return (
                <tr key={q.question_id} className={ok ? "" : "bg-red-50/40"}>
                  <td className="px-5 py-3 font-bold text-ink">{q.number}</td>
                  <td className={`px-5 py-3 ${q.your_answer ? "text-ink" : "italic text-ink-muted"}`}>
                    {q.your_answer || "no answer"}
                  </td>
                  <td className="px-5 py-3 font-medium text-emerald-700">
                    {/* "Choose TWO" — нужны все варианты; у текстовых ответов — любой из написаний */}
                    {q.correct_answers.join(q.type === "mcq_multi" ? ", " : " / ")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {ok ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                        <XCircle className="h-4 w-4" /> {partial ? `${q.earned}/${q.points}` : "Wrong"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
