import type { MacroRegion } from "./regions";
import type { AnalyzeResponse } from "./types";

type ShareData = {
  title: string;
  text: string;
  url?: string;
};

/** 결과별로 친구에게 자연스럽게 말 걸 수 있는 한 줄 */
export function buildShareHook(result: AnalyzeResponse): string {
  const region = result.location.region;
  const { signal, signal_label, score } = result.decision;

  if (signal === "red") {
    return `우리 동네(${region})는 세차하면 안 된대 ㅋㅋ 니네 동네는?`;
  }
  if (signal === "yellow") {
    return `우리 동네(${region})는 ${signal_label}래 (${score}점). 니네 동네는?`;
  }
  return `우리 동네(${region})는 오늘 세차해도 된대! 니네 동네는?`;
}

export function buildConclusionSharePayload(result: AnalyzeResponse): ShareData {
  const hook = buildShareHook(result);
  const { location, decision, rain_forecast } = result;

  const pollenLine =
    decision.logic.pollen.available && decision.logic.pollen.three_day_worst_label
      ? `꽃가루: ${decision.logic.pollen.three_day_worst_label}`
      : null;

  const detail = [
    `📍 ${location.region} · ${decision.score}점 · ${decision.signal_label}`,
    `강수 최대 ${rain_forecast.three_day_max_pop}% · 비 예보 ${rain_forecast.rainy_day_count}일`,
    `미세먼지: ${decision.logic.dust.three_day_worst_label}`,
    pollenLine,
  ]
    .filter(Boolean)
    .join("\n");

  const text = [hook, "", detail, "", "👉 위치 눌러서 니네 동네도 확인해봐"].join("\n");

  return {
    title: "오늘 세차, 해도 될까?",
    text,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

export function buildRegionShareHook(
  myResult: AnalyzeResponse,
  friendRegion: MacroRegion,
  friendResult: AnalyzeResponse,
): string {
  const myPlace = myResult.location.region;
  const myLabel = myResult.decision.signal_label;
  const friendLabel = friendResult.decision.signal_label;
  const friendScore = friendResult.decision.score;

  if (friendResult.decision.signal === "red") {
    return `우리 동네(${myPlace})는 ${myLabel}인데, ${friendRegion.label}은 세차하면 안 된대 ㅋㅋ 니네 동네는?`;
  }
  if (friendResult.decision.signal === "yellow") {
    return `우리 동네(${myPlace})는 ${myLabel}인데, ${friendRegion.label}은 ${friendLabel}래 (${friendScore}점). 니네 동네는?`;
  }
  return `우리 동네(${myPlace})는 ${myLabel}인데, ${friendRegion.label}은 세차해도 된대! 니네 동네는?`;
}

export function buildRegionSharePayload(
  myResult: AnalyzeResponse,
  friendRegion: MacroRegion,
  friendResult: AnalyzeResponse,
): ShareData {
  const hook = buildRegionShareHook(myResult, friendRegion, friendResult);
  const detail = [
    `📍 내 동네 · ${myResult.decision.score}점 · ${myResult.decision.signal_label}`,
    `📍 ${friendRegion.label} 권역(${friendRegion.anchor} 기준) · ${friendResult.decision.score}점 · ${friendResult.decision.signal_label}`,
    "",
    "👉 위치 눌러서 니네 동네도 확인해봐",
  ].join("\n");

  return {
    title: "오늘 세차, 해도 될까?",
    text: [hook, "", detail].join("\n"),
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

export async function shareRegionComparison(
  myResult: AnalyzeResponse,
  friendRegion: MacroRegion,
  friendResult: AnalyzeResponse,
): Promise<"shared" | "copied" | "cancelled"> {
  const payload = buildRegionSharePayload(myResult, friendRegion, friendResult);
  const fallbackText = [payload.text, payload.url].filter(Boolean).join("\n\n");

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: fallbackText,
        url: payload.url,
      });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  await navigator.clipboard.writeText(fallbackText);
  return "copied";
}

export async function shareConclusion(result: AnalyzeResponse): Promise<"shared" | "copied" | "cancelled"> {
  const payload = buildConclusionSharePayload(result);
  const fallbackText = [payload.text, payload.url].filter(Boolean).join("\n\n");

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: fallbackText,
        url: payload.url,
      });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  await navigator.clipboard.writeText(fallbackText);
  return "copied";
}
