import type { AnalyzeResponse } from "./types";

export function buildConclusionSharePayload(result: AnalyzeResponse): ShareData {
  const { location, decision, rain_forecast } = result;

  const pollenLine =
    decision.logic.pollen.available && decision.logic.pollen.three_day_worst_label
      ? `꽃가루 최악: ${decision.logic.pollen.three_day_worst_label}`
      : null;

  const text = [
    `📍 ${location.region} · ${location.station_name}`,
    `결론: ${decision.signal_label}`,
    `종합 점수: ${decision.score}점`,
    "",
    `강수 최대 ${rain_forecast.three_day_max_pop}% · 비 예보 ${rain_forecast.rainy_day_count}일`,
    `미세먼지 최악: ${decision.logic.dust.three_day_worst_label}`,
    pollenLine,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: "오늘 세차 할까?",
    text,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

export async function shareConclusion(result: AnalyzeResponse): Promise<"shared" | "copied" | "cancelled"> {
  const payload = buildConclusionSharePayload(result);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  const fallbackText = [payload.text, payload.url].filter(Boolean).join("\n\n");
  await navigator.clipboard.writeText(fallbackText);
  return "copied";
}
