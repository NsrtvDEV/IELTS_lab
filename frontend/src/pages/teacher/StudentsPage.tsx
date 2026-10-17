import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Search, UsersRound } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { listStudents, type SectionType, type StudentSummary } from "../../api/teacher";
import { Badge, Card, ErrorBox, Spinner } from "../../components/ui";
import { initials, timeAgo } from "../../lib/format";
import { SECTION_LABELS } from "../../lib/questionTypes";

const SECTIONS: SectionType[] = ["listening", "reading", "writing", "speaking"];

export function StudentsPage() {
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  function load(q?: string) {
    listStudents(q)
      .then(setStudents)
      .catch((err) => setError(apiErrorMessage(err)));
  }

  useEffect(() => load(), []);

  function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStudents(null);
    load(query.trim());
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Students</h1>
          <p className="mt-1 text-ink-muted">Latest band per section and each student&apos;s test history.</p>
        </div>
        <form onSubmit={search} className="relative w-full max-w-xs" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or email…"
            aria-label="Search students"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
        </form>
      </div>

      <div className="mt-6">
        <ErrorBox message={error} />
        {!students && !error && <Spinner />}
        {students && students.length === 0 && (
          <Card className="flex flex-col items-center px-6 py-14 text-center text-ink-muted">
            <UsersRound className="h-8 w-8" />
            <p className="mt-3">{query ? "No students match your search." : "No students have registered yet."}</p>
          </Card>
        )}
        {students && students.length > 0 && (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-ink-muted">
                  <th className="px-5 py-3 font-medium">Student</th>
                  {SECTIONS.map((s) => (
                    <th key={s} className="px-3 py-3 text-center font-medium">
                      {SECTION_LABELS[s]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">Overall</th>
                  <th className="px-5 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/teacher/students/${s.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                          {initials(s.name)}
                        </span>
                        <span>
                          <span className="block font-semibold text-ink hover:text-brand-600">{s.name}</span>
                          <span className="block text-xs text-ink-muted">{s.email}</span>
                        </span>
                        {!s.is_active && <Badge color="amber">Blocked</Badge>}
                      </Link>
                    </td>
                    {SECTIONS.map((sec) => (
                      <td key={sec} className="px-3 py-3 text-center font-semibold text-ink">
                        {s.bands[sec] ?? <span className="font-normal text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center font-bold text-ink">{s.overall_band ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-muted">
                      {s.last_activity_at ? timeAgo(s.last_activity_at) : `joined ${timeAgo(s.joined_at)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
