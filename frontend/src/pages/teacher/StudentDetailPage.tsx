import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { getStudent, getStudentResult, type HistoryItem, type SectionType, type StudentDetail } from "../../api/teacher";
import type { SectionResult } from "../../api/student";
import { ResultView } from "../../components/results/ResultView";
import { Badge, Card, ErrorBox, Spinner } from "../../components/ui";
import { initials, timeAgo } from "../../lib/format";
import { SECTION_LABELS } from "../../lib/questionTypes";
import { t } from "../../i18n";

const SECTIONS: SectionType[] = ["listening", "reading", "writing", "speaking"];
const WITH_REVIEW: SectionType[] = ["listening", "reading"]; // разбор по вопросам есть только здесь

function Status({ item }: { item: HistoryItem }) {
  if (item.status === "abandoned") return <Badge color="gray">{t("Abandoned")}</Badge>;
  if (!item.submitted_at) return <Badge color="amber">{t("In progress")}</Badge>;
  if (item.band_score === null) return <Badge color="blue">{t("Waiting for review")}</Badge>;
  return <Badge color="green">{t("Band")} {item.band_score}</Badge>;
}

export function StudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStudent(Number(studentId))
      .then(setStudent)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [studentId]);

  if (!student) return error ? <ErrorBox message={error} /> : <Spinner />;

  return (
    <>
      <Link to="/teacher/students" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t("All students")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
          {initials(student.name)}
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{student.name}</h1>
          <p className="text-ink-muted">
            {student.email} · {t("joined {when}", { when: timeAgo(student.joined_at) })}
            {student.native_language ? ` · ${t("native language: {lang}", { lang: student.native_language })}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SECTIONS.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs font-medium text-ink-muted">{SECTION_LABELS[s]}</div>
            <div className="mt-1 text-2xl font-extrabold text-ink">{student.bands[s] ?? "—"}</div>
          </Card>
        ))}
        <Card className="bg-brand-50 p-4">
          <div className="text-xs font-medium text-brand-700">{t("Overall")}</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-600">{student.overall_band ?? "—"}</div>
        </Card>
      </div>

      <h2 className="mt-8 text-lg font-bold text-ink">{t("History")}</h2>
      {student.history.length === 0 ? (
        <Card className="mt-3 px-6 py-10 text-center text-ink-muted">{t("This student hasn't taken any tests yet.")}</Card>
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-ink-muted">
                <th className="px-5 py-3 font-medium">{t("Test")}</th>
                <th className="px-5 py-3 font-medium">{t("Section")}</th>
                <th className="px-5 py-3 font-medium">{t("Date")}</th>
                <th className="px-5 py-3 font-medium">{t("Score")}</th>
                <th className="px-5 py-3 font-medium">{t("Status")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {student.history.map((h) => (
                <tr key={h.section_attempt_id}>
                  <td className="px-5 py-3 font-medium text-ink">{h.test_title}</td>
                  <td className="px-5 py-3 text-ink">
                    {SECTION_LABELS[h.section_type]}
                    {h.mode === "mock" && <span className="ml-1.5 text-xs text-ink-muted">({t("full mock")})</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{timeAgo(h.submitted_at ?? h.started_at)}</td>
                  <td className="px-5 py-3 text-ink">{h.raw_score !== null ? t("{n} pts", { n: h.raw_score }) : "—"}</td>
                  <td className="px-5 py-3">
                    <Status item={h} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {h.submitted_at && WITH_REVIEW.includes(h.section_type) && (
                      <Link
                        to={`/teacher/students/${student.id}/results/${h.section_attempt_id}`}
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {t("Answers")} →
                      </Link>
                    )}
                    {h.submitted_at && (h.section_type === "writing" || h.section_type === "speaking") && h.status !== "abandoned" && (
                      <Link
                        to={`/teacher/review/${h.section_type}/${h.section_attempt_id}`}
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {h.band_score === null ? t("Assess") : h.section_type === "writing" ? t("Essays") : t("Recordings")} →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

export function StudentResultPage() {
  const { studentId, sectionAttemptId } = useParams();
  const [result, setResult] = useState<SectionResult | null>(null);
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStudentResult(Number(studentId), Number(sectionAttemptId)), getStudent(Number(studentId))])
      .then(([r, s]) => {
        setResult(r);
        setName(s.name);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [studentId, sectionAttemptId]);

  if (!result) return error ? <ErrorBox message={error} /> : <Spinner />;
  return (
    <ResultView result={result} backTo={`/teacher/students/${studentId}`} backLabel={name || t("Student")} heading={name} />
  );
}
