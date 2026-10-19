import { BookOpen, Headphones, Mic, PenLine, type LucideIcon } from "lucide-react";
import type { SectionType } from "../api/teacher";

export const SECTION_ICONS: Record<SectionType, LucideIcon> = {
  reading: BookOpen,
  listening: Headphones,
  writing: PenLine,
  speaking: Mic,
};

// оттенки карточек секций (классы целиком — Tailwind находит их в исходниках)
export const SECTION_TINTS: Record<SectionType, { card: string; icon: string; button: string }> = {
  reading: { card: "border-brand-100 bg-brand-50/60", icon: "bg-brand-100 text-brand-600", button: "bg-brand-500 hover:bg-brand-600" },
  listening: { card: "border-emerald-100 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-600", button: "bg-emerald-500 hover:bg-emerald-600" },
  writing: { card: "border-violet-100 bg-violet-50/60", icon: "bg-violet-100 text-violet-600", button: "bg-violet-500 hover:bg-violet-600" },
  speaking: { card: "border-rose-100 bg-rose-50/60", icon: "bg-rose-100 text-rose-500", button: "bg-[#f26b6b] hover:bg-rose-500" },
};
