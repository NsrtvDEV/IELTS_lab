import type { LandingContent } from "../lib/landing";
import { apiClient } from "./client";

export async function getLanding() {
  const { data } = await apiClient.get<Partial<LandingContent>>("/site/landing");
  return data;
}

export async function getLandingForEdit() {
  const { data } = await apiClient.get<Partial<LandingContent>>("/admin/landing");
  return data;
}

export async function saveLanding(content: LandingContent) {
  const { data } = await apiClient.put<Partial<LandingContent>>("/admin/landing", content);
  return data;
}

export async function resetLanding() {
  await apiClient.delete("/admin/landing");
}
