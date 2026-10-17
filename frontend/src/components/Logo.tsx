import { GraduationCap } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <GraduationCap className="h-12 w-12 fill-brand-500 text-brand-500" strokeWidth={1.75} />
      <div>
        <div className="text-[32px] font-bold leading-none tracking-tight text-ink">BandUp</div>
        <div className="mt-1.5 text-[13px] font-medium text-ink-muted">IELTS Learning Platform</div>
      </div>
    </div>
  );
}
