"use client";

import { useState } from "react";
import { fetchAnalysis } from "@/lib/api";
import { MACRO_REGIONS, type MacroRegion, type MacroRegionId } from "@/lib/regions";
import { shareRegionComparison } from "@/lib/share";
import type { AnalyzeResponse } from "@/lib/types";

function SignalDot({ signal }: { signal: "green" | "yellow" | "red" }) {
  return <span className={`friend-signal-dot ${signal}`} aria-hidden="true" />;
}

type FriendRegionExplorerProps = {
  onClose: () => void;
};

export function FriendRegionExplorer({ onClose }: FriendRegionExplorerProps) {
  const [loadingRegionId, setLoadingRegionId] = useState<MacroRegionId | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<MacroRegion | null>(null);
  const [friendResult, setFriendResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const handleSelectRegion = async (region: MacroRegion) => {
    setLoadingRegionId(region.id);
    setSelectedRegion(region);
    setFriendResult(null);
    setError(null);
    setShareNotice(null);

    try {
      const data = await fetchAnalysis(region.lat, region.lng);
      setFriendResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "권역 분석에 실패했습니다.");
    } finally {
      setLoadingRegionId(null);
    }
  };

  const handleShare = async () => {
    if (!selectedRegion || !friendResult) return;

    try {
      const outcome = await shareRegionComparison(selectedRegion, friendResult);
      if (outcome === "cancelled") return;
      setShareNotice(
        outcome === "copied"
          ? "복사됐어요. 카톡에 붙여넣어 보내세요."
          : "공유 창에서 앱을 골라 보내세요.",
      );
    } catch {
      setShareNotice("공유에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }

    window.setTimeout(() => setShareNotice(null), 2800);
  };

  return (
    <section className="friend-region-card friend-region-card--open">
      <div className="friend-region-head">
        <h2 className="friend-region-title">친구동네 찾아보기</h2>
        <p className="friend-region-desc">권역을 눌러 대략적인 요약을 확인할 수 있어요.</p>
      </div>

      <p className="friend-region-notice">
        권역은 넓어 실제 날씨와 다를 수 있어요. 정확한 점수·3일 예보·점수 계산은 &apos;내 위치로
        분석하기&apos;를 눌러 본인 위치 기준으로 확인하세요.
      </p>

      <div className="friend-region-map" aria-label="대한민국 권역 지도">
        {MACRO_REGIONS.map((region) => (
          <button
            key={region.id}
            type="button"
            className={`friend-region-btn area-${region.gridArea}${
              selectedRegion?.id === region.id ? " selected" : ""
            }`}
            style={{ gridArea: region.gridArea }}
            disabled={loadingRegionId !== null}
            onClick={() => void handleSelectRegion(region)}
          >
            <span className="friend-region-btn-label">{region.label}</span>
            {loadingRegionId === region.id && (
              <span className="friend-region-btn-loading">확인 중...</span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="friend-region-error">{error}</p>}

      {selectedRegion && friendResult && (
        <div className="friend-region-result">
          <p className="friend-region-result-meta">
            <strong>{selectedRegion.label} 권역 요약</strong> ({selectedRegion.anchor} 인근)
          </p>
          <div className="friend-region-result-main">
            <SignalDot signal={friendResult.decision.signal} />
            <div>
              <p className="friend-region-result-label">{friendResult.decision.signal_label}</p>
              <p className="friend-region-result-score">종합 {friendResult.decision.score}점</p>
            </div>
          </div>
          <p className="friend-region-notice friend-region-notice--compact">
            요약만 표시됩니다. 강수·미세먼지·꽃가루·점수 계산은 앱에서 해당 권역 또는 내 위치를
            눌러 확인하세요.
          </p>
          <button type="button" className="friend-region-share-btn" onClick={() => void handleShare()}>
            {selectedRegion.friendShareLabel}
          </button>
          {shareNotice && <p className="friend-region-share-notice">{shareNotice}</p>}
        </div>
      )}

      <button type="button" className="friend-region-close-btn" onClick={onClose}>
        닫기
      </button>
    </section>
  );
}
