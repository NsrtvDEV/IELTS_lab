import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import type { Attempt } from "../api/student";
import { SECTION_LABELS } from "../lib/questionTypes";
import { Button, Card } from "./ui";

/** Начатая и не сданная секция — её можно продолжить */
export function UnfinishedBanner({ attempts }: { attempts: Attempt[] }) {
  const unfinished = attempts
    .filter((a) => a.status === "in_progress")
    .flatMap((a) => a.sections.filter((s) => !s.submitted_at).map((s) => ({ a, s })))[0];
  if (!unfinished) return null;
  return (
    <Card className="flex flex-wrap items-center gap-4 border-brand-200 bg-brand-50/50 p-5">
      <PlayCircle className="h-8 w-8 text-brand-500" />
      <div className="min-w-48 flex-1">
        <div className="font-semibold text-ink">You have an unfinished {SECTION_LABELS[unfinished.s.section_type]} test</div>
        <div className="text-sm text-ink-muted">{unfinished.a.test_title} — the timer keeps running.</div>
      </div>
      <Link to={`/${unfinished.s.section_type}/${unfinished.s.id}`}>
        <Button>Continue</Button>
      </Link>
    </Card>
  );
}
