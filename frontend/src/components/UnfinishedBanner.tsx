import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import type { Attempt } from "../api/student";
import { continuePath, isMock, isUnfinished } from "../lib/attempts";
import { SECTION_LABELS } from "../lib/questionTypes";
import { Button, Card } from "./ui";

/** Начатая и не сданная секция или полный экзамен на середине — его можно продолжить */
export function UnfinishedBanner({ attempts }: { attempts: Attempt[] }) {
  const attempt = attempts.find(isUnfinished);
  if (!attempt) return null;
  const open = attempt.sections.find((s) => !s.submitted_at);
  const title = isMock(attempt)
    ? "You have an unfinished full mock test"
    : `You have an unfinished ${SECTION_LABELS[open?.section_type ?? attempt.section_type!]} test`;
  const note = open
    ? `${SECTION_LABELS[open.section_type]} is in progress — the timer keeps running.`
    : `Next: ${SECTION_LABELS[attempt.next_section!]}. Start it when you're ready.`;
  return (
    <Card className="flex flex-wrap items-center gap-4 border-brand-200 bg-brand-50/50 p-5">
      <PlayCircle className="h-8 w-8 text-brand-500" />
      <div className="min-w-48 flex-1">
        <div className="font-semibold text-ink">{title}</div>
        <div className="text-sm text-ink-muted">
          {attempt.test_title} — {note}
        </div>
      </div>
      <Link to={continuePath(attempt)}>
        <Button>Continue</Button>
      </Link>
    </Card>
  );
}
