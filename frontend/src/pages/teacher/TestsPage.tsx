import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileText, Plus } from "lucide-react";
import { apiErrorMessage } from "../../api/client";
import { createTest, listTests, type TeacherTest } from "../../api/teacher";
import { Badge, Button, Card, ErrorBox, Label, Modal, Spinner, inputClass } from "../../components/ui";
import { SECTION_LABELS } from "../../lib/questionTypes";

export function TestStatus({ test }: { test: TeacherTest }) {
  if (test.is_published) return <Badge color="green">Published</Badge>;
  if (test.problems.length === 0) return <Badge color="blue">Ready to publish</Badge>;
  return <Badge color="gray">Draft</Badge>;
}

function CreateTestModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }
    setSaving(true);
    try {
      const test = await createTest(title.trim());
      navigate(`/teacher/tests/${test.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="New mock test" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="test-title">Title</Label>
          <input
            id="test-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Cambridge IELTS 19 — Test 1"
            className={inputClass}
            maxLength={255}
          />
          <p className="mt-2 text-sm text-ink-muted">
            The test gets 4 sections with standard IELTS timing: Listening 30 min, Reading 60,
            Writing 60, Speaking 14.
          </p>
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create test
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TestsPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const [tests, setTests] = useState<TeacherTest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const shown = tests?.filter((t) => t.title.toLowerCase().includes(query)) ?? null;

  useEffect(() => {
    listTests()
      .then(setTests)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mock tests</h1>
          <p className="mt-1 text-ink-muted">Create tests, fill in sections and publish them for students.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New test
        </Button>
      </div>

      <div className="mt-8">
        <ErrorBox message={error} />
        {!tests && !error && <Spinner />}
        {tests && tests.length === 0 && (
          <Card className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <FileText className="h-7 w-7 text-brand-500" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink">No tests yet</h2>
            <p className="mt-1 text-sm text-ink-muted">Create your first mock test to get started.</p>
            <Button className="mt-6" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New test
            </Button>
          </Card>
        )}
        {query && tests && (
          <div className="mb-4 flex items-center gap-3 text-sm text-ink-muted">
            {shown?.length} result(s) for “{params.get("q")}”
            <button onClick={() => setParams({})} className="font-semibold text-brand-600 hover:text-brand-700">
              Clear
            </button>
          </div>
        )}
        {shown && tests && tests.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((test) => (
              <Link key={test.id} to={`/teacher/tests/${test.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:border-brand-200 group-hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold text-ink group-hover:text-brand-600">{test.title}</h2>
                    <TestStatus test={test} />
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {test.sections.map((s) => (
                      <div key={s.id} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                        <div className="text-xs text-ink-muted">{SECTION_LABELS[s.type]}</div>
                        <div className="text-sm font-semibold text-ink">
                          {s.type === "listening" || s.type === "reading"
                            ? `${s.question_count}/40`
                            : `${s.duration_min} min`}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm">
                    {test.is_published || test.problems.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" /> Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <AlertTriangle className="h-4 w-4" /> {test.problems.length} thing(s) to finish
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {creating && <CreateTestModal onClose={() => setCreating(false)} />}
    </>
  );
}
