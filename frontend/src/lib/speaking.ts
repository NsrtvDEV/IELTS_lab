import type { SpeakingScores } from "../api/student";
import { t } from "../i18n";
import { roundBand } from "./writing";

/** Четыре официальных критерия Speaking */
export const SPEAKING_CRITERIA: { key: keyof SpeakingScores; label: string }[] = [
  { key: "fluency_coherence", label: t("Fluency & Coherence") },
  { key: "lexical_resource", label: t("Lexical Resource") },
  { key: "grammatical_range", label: t("Grammatical Range & Accuracy") },
  { key: "pronunciation", label: t("Pronunciation") },
];

export const PARTS: Record<1 | 2 | 3, { title: string; about: string }> = {
  1: { title: t("Introduction and interview"), about: t("Questions about yourself, your home, work or studies and familiar topics.") },
  2: { title: t("Long turn"), about: t("You get a card with a topic. You have 1 minute to prepare and then speak for up to 2 minutes.") },
  3: { title: t("Discussion"), about: t("More abstract questions connected with the topic of Part 2.") },
};

/** Band Speaking: среднее четырёх критериев */
export function speakingBand(scores: SpeakingScores) {
  return roundBand(SPEAKING_CRITERIA.reduce((sum, c) => sum + scores[c.key], 0) / SPEAKING_CRITERIA.length);
}

export function formatSeconds(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
