import type { MacroRegion } from "./regions";
import type { AnalyzeResponse } from "./types";

type ShareData = {
  title: string;
  text: string;
  url?: string;
};

const SHARE_TITLE = "오늘 세차, 해도 될까?";

const REGION_ACCURACY_NOTICE = [
  "※ 권역은 넓어 대략적인 결과입니다.",
  "정확한 점수·예보·점수 계산은 링크에서",
  "'내 위치로 분석하기'를 눌러 확인하세요.",
].join("\n");

const MY_LOCATION_DETAIL_NOTICE = [
  "강수·미세먼지·점수 계산 등 자세한 내용은",
  "앱에서 '내 위치로 분석하기'로 확인할 수 있어요.",
].join("\n");

export function buildConclusionSharePayload(result: AnalyzeResponse): ShareData {
  const { location, decision } = result;

  const summary = `${location.region} · ${decision.signal_label} · ${decision.score}점`;
  const text = [SHARE_TITLE, "", summary, "", MY_LOCATION_DETAIL_NOTICE].join("\n");

  return {
    title: SHARE_TITLE,
    text,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

export function buildRegionSharePayload(
  myResult: AnalyzeResponse,
  friendRegion: MacroRegion,
  friendResult: AnalyzeResponse,
): ShareData {
  const myLine = `[내 위치] ${myResult.location.region} · ${myResult.decision.score}점 · ${myResult.decision.signal_label}`;
  const regionLine = `[권역 요약] ${friendRegion.label} · ${friendResult.decision.score}점 · ${friendResult.decision.signal_label}`;
  const regionNote = `(${friendRegion.anchor} 인근 기준, 참고용)`;

  const text = [
    SHARE_TITLE,
    "",
    myLine,
    regionLine,
    regionNote,
    "",
    "권역 결과는 참고용입니다.",
    "정확한 점수는 링크에서 내 위치로 분석해 주세요.",
    "",
    REGION_ACCURACY_NOTICE,
  ].join("\n");

  return {
    title: SHARE_TITLE,
    text,
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
