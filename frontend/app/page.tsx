"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAnalysis,
  fetchCurrentAir,
  getCurrentPosition,
  getLocationErrorMessage,
  LocationError,
} from "@/lib/api";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { shareConclusion } from "@/lib/share";
import type { AnalyzeResponse } from "@/lib/types";

const KMA_WEATHER_URL = "https://www.weather.go.kr/w/index.do";
const AIRKOREA_FORECAST_URL = "https://www.airkorea.or.kr/web/dustForecast?pMENU_NO=113";
const KMA_POLLEN_URL = "https://www.weather.go.kr/w/forecast/life.do";
function DustGrade({ grade }: { grade: number }) {
  const labels = ["", "좋음", "보통", "나쁨", "매우나쁨"];
  return <>{labels[grade] ?? "보통"}</>;
}

function PollenGrade({ grade }: { grade: number }) {
  const labels = ["낮음", "보통", "높음", "매우높음"];
  return <>{labels[grade] ?? "낮음"}</>;
}

function SignalIndicator({ signal }: { signal: "green" | "yellow" | "red" }) {
  const lights: Array<"red" | "yellow" | "green"> = ["red", "yellow", "green"];
  return (
    <div className="signal-indicator" aria-hidden="true">
      <div className="signal-housing">
        {lights.map((color) => (
          <span
            key={color}
            className={`signal-bulb ${color}${signal === color ? " active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

function ShareConclusionButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="conclusion-share-btn" onClick={onClick}>
      <svg className="conclusion-share-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22 11 13 2 9 22 2Z" />
      </svg>
      <span>공유하기</span>
    </button>
  );
}

function VerifyLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="verify-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}에서 직접 확인`}
    >
      <span className="verify-link-text">{label}</span>
      <span className="verify-link-arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

export default function HomePage() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"location" | "forecast" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [showLogicSection, setShowLogicSection] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareNoticeSource, setShareNoticeSource] = useState<"summary" | "logic" | null>(null);
  const analysisInFlightRef = useRef(false);

  const openLogicSection = () => {
    setShowLogicSection(true);
    requestAnimationFrame(() => {
      const scrollTarget =
        document.getElementById("score-explanation") ?? document.getElementById("decision-logic");
      scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleShareConclusion = async (source: "summary" | "logic") => {
    if (!result) return;

    try {
      const outcome = await shareConclusion(result);
      if (outcome === "cancelled") return;
      setShareNoticeSource(source);
      if (outcome === "copied") {
        setShareNotice("복사됐어요. 카톡·문자·메일에 붙여넣기 하세요.");
      } else {
        setShareNotice("공유 창에서 앱을 골라 보내세요.");
      }
    } catch {
      setShareNoticeSource(source);
      setShareNotice("공유에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }

    window.setTimeout(() => {
      setShareNotice(null);
      setShareNoticeSource(null);
    }, 2800);
  };

  const loadAnalysis = useCallback(async () => {
    if (analysisInFlightRef.current) return;
    analysisInFlightRef.current = true;
    setLoading(true);
    setLoadingPhase("location");
    setError(null);
    try {
      const position = await getCurrentPosition();
      setLoadingPhase("forecast");
      const data = await fetchAnalysis(
        position.coords.latitude,
        position.coords.longitude,
      );
      setResult(data);
      void fetchCurrentAir(data.location.station_name)
        .then((currentAir) => {
          setResult((prev) => (prev ? { ...prev, current_air: currentAir } : prev));
        })
        .catch(() => {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  current_air: {
                    ...prev.current_air,
                    loading: false,
                    pm25_grade_label: "측정 불가",
                  },
                }
              : prev,
          );
        });
      setShowLogicSection(false);
      setShareNotice(null);
      setShareNoticeSource(null);
    } catch (err) {
      setResult(null);
      const isLocationError =
        err instanceof LocationError ||
        (err && typeof err === "object" && "code" in err);
      setNeedsLocation(Boolean(isLocationError));
      setError(getLocationErrorMessage(err));
    } finally {
      analysisInFlightRef.current = false;
      setLoading(false);
      setLoadingPhase(null);
    }
  }, []);

  const brandSubtitle = loading
    ? loadingPhase === "location"
      ? "위치 확인 중..."
      : "예보 불러오는 중..."
    : result
      ? `${result.location.region} · ${result.location.station_name}`
      : "버튼을 누르면 내 위치 기준으로 분석합니다";

  return (
    <main>
      <div className="topbar">
        <section className="brand">
          <h1>오늘 세차, 해도 될까?</h1>
          <p>{brandSubtitle}</p>
        </section>
      </div>

      {!result && !loading && !error && (
        <section className="score-check-card">
          <button type="button" className="score-check-btn" onClick={loadAnalysis}>
            내 위치로 분석하기
          </button>
        </section>
      )}

      {error && (
        <section className="card">
          <div className="error" style={{ marginBottom: needsLocation ? 14 : 0 }}>{error}</div>
          {!needsLocation && (
            <button className="google-btn" onClick={loadAnalysis} disabled={loading} style={{ marginTop: 14 }}>
              다시 시도
            </button>
          )}
          {needsLocation && (
            <>
              <button className="google-btn" onClick={loadAnalysis} disabled={loading}>
                📍 위치 허용 후 다시 시도
              </button>
              <p className="footer" style={{ marginTop: 12, textAlign: "left" }}>
                Chrome/Edge 주소창 왼쪽 자물쇠 아이콘 → 사이트 설정 → 위치 → <strong>허용</strong>
                <br />
                Cursor 내장 브라우저보다 일반 브라우저에서 더 잘 동작합니다.
              </p>
            </>
          )}
        </section>
      )}
      {result && !loading && (
        <>
          <section className="score-check-card">
            <button type="button" className="score-check-btn" onClick={openConclusionPopup}>
              점수 확인
            </button>
          </section>

          <section className="card">
            <div className="section-head">
              <div className="section-title">3일 강수예보</div>
              <div className="verify-links">
                <VerifyLink href={KMA_WEATHER_URL} label="기상청" />
              </div>
            </div>
            <div className="forecast-verify-meta">
              <div>
                {result.rain_forecast.forecast_meta.source}
                {result.rain_forecast.forecast_meta.base_datetime && (
                  <> · 발표 {result.rain_forecast.forecast_meta.base_datetime}</>
                )}
              </div>
              <div>집계 규칙: {result.rain_forecast.forecast_meta.pop_rule}</div>
            </div>
            <div className="day-grid">
              {result.rain_forecast.days.map((day, index) => (
                <div key={`${day.label}-${index}`} className="day-card forecast expanded">
                  <div className="day-label">{day.label}</div>
                  <div className="day-card-content-zone">
                    <div className="day-card-body">
                      <div className="day-card-inner">
                        <div className="day-value forecast-grade">{day.max_pop}%</div>
                        <div className="day-sub">강수확률</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="summary-bar revealed">
              <span>3일 평균 {result.rain_forecast.three_day_avg_pop}%</span>
              <span>최대 {result.rain_forecast.three_day_max_pop}%</span>
              <span>비 예보 {result.rain_forecast.rainy_day_count}일</span>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div className="section-title">3일 초미세먼지 예보</div>
              <VerifyLink href={AIRKOREA_FORECAST_URL} label="대기질 예보" />
            </div>
            <div className="forecast-verify-meta">
              <div>
                {result.dust_forecast.forecast_meta.source}
                {result.dust_forecast.forecast_meta.data_time && (
                  <> · 발표 {result.dust_forecast.forecast_meta.data_time}</>
                )}
              </div>
            </div>
            <div className="day-grid">
              {result.dust_forecast.days.map((day, index) => (
                <div key={`${day.label}-${index}`} className="day-card forecast expanded">
                  <div className="day-label">{day.label}</div>
                  <div className="day-card-content-zone">
                    <div className="day-card-body">
                      <div className="day-card-inner">
                        <div className="day-value forecast-grade">
                          <DustGrade grade={day.grade} />
                        </div>
                        <div className="day-sub">PM2.5 예보</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="summary-bar revealed">
              {result.current_air.loading ? (
                <span>현재 대기질 불러오는 중...</span>
              ) : (
                <>
                  <span>
                    현재 {result.current_air.pm25_value} ㎍/㎥
                    {result.current_air.data_time && (
                      <> ({result.current_air.data_time})</>
                    )}
                  </span>
                  <span>현재 {result.current_air.pm25_grade_label}</span>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div className="section-title">3일 꽃가루 예보</div>
              <VerifyLink href={KMA_POLLEN_URL} label="기상청" />
            </div>
            <div className="forecast-verify-meta">
              <div>
                {result.pollen_forecast.forecast_meta.source}
                {result.pollen_forecast.forecast_meta.data_time && (
                  <> · 발표 {result.pollen_forecast.forecast_meta.data_time}</>
                )}
              </div>
              <div>{result.pollen_forecast.forecast_meta.season_note}</div>
            </div>
            {result.pollen_forecast.available ? (
              <>
                <div className="day-grid">
                  {result.pollen_forecast.days.map((day, index) => (
                    <div key={`${day.label}-${index}`} className="day-card forecast expanded">
                      <div className="day-label">{day.label}</div>
                      <div className="day-card-content-zone">
                        <div className="day-card-body">
                          <div className="day-card-inner">
                            <div className="day-value forecast-grade">
                              <PollenGrade grade={day.grade} />
                            </div>
                            <div className="day-sub pollen-species-list">
                              {day.active_species_labels.length > 0
                                ? day.active_species_labels.map((species) => (
                                    <span key={species} className="pollen-species-item">
                                      {species}
                                    </span>
                                  ))
                                : "꽃가루 예보"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {result.pollen_forecast.three_day_worst_grade !== null && (
                  <div className="summary-bar revealed">
                    <span>
                      3일 최악{" "}
                      <PollenGrade grade={result.pollen_forecast.three_day_worst_grade} />
                    </span>
                    <span>{result.pollen_forecast.forecast_meta.region} 권역</span>
                  </div>
                )}
              </>
            ) : (
              <p className="pollen-unavailable">
                {result.pollen_forecast.in_season
                  ? result.pollen_forecast.unavailable_reason ??
                    "꽃가루 예보를 불러오지 못했습니다."
                  : result.pollen_forecast.forecast_meta.season_note}
              </p>
            )}
          </section>

          {showLogicSection && (
          <>
          {result.decision.reasons.length > 0 && (
            <section id="score-explanation" className="card decision-logic-card revealed-block">
              <div className="section-title" style={{ marginBottom: 12 }}>
                최종점수 풀이
              </div>
              <ul className="logic-list logic-reasons">
                {result.decision.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
          )}
          <section id="decision-logic" className="card decision-logic-card revealed-block">
            <div className="section-title" style={{ marginBottom: 12 }}>
              점수 계산 방법
            </div>
            <p className="logic-overview">{result.decision.logic.overview}</p>

            <h3 className="logic-subtitle">1. 입력 데이터</h3>
            <div className="logic-block">
              <div className="logic-block-title">강수 (기상청 단기예보)</div>
              <ul className="logic-list">
                <li>집계 규칙: {result.decision.logic.rain.pop_rule}</li>
                <li>
                  3일 최대 {result.decision.logic.rain.three_day_max_pop}% · 평균{" "}
                  {result.decision.logic.rain.three_day_avg_pop}%
                </li>
                <li>
                  비 예보 일수 {result.decision.logic.rain.rainy_day_count}일 (
                  {result.decision.logic.rain.rainy_day_rule})
                </li>
              </ul>
              <div className="logic-day-table">
                {result.decision.logic.rain.days.map((day) => (
                  <div key={day.label} className="logic-day-row">
                    <span>{day.label}</span>
                    <span>최대 {day.max_pop}%</span>
                    <span>{day.has_rain ? "강수 형태 있음" : "강수 형태 없음"}</span>
                    <span className={day.counts_as_rainy ? "logic-flag-on" : "logic-flag-off"}>
                      {day.counts_as_rainy ? "비 예보 일수 포함" : "미포함"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="logic-block">
              <div className="logic-block-title">
                초미세먼지 (PM2.5 · {result.decision.logic.dust.region})
              </div>
              <ul className="logic-list">
                <li>3일 최악 등급: {result.decision.logic.dust.three_day_worst_label}</li>
                <li>3일 평균 등급 점수: {result.decision.logic.dust.three_day_avg_grade}</li>
                <li>현재 실측 농도는 화면 참고용이며 판정 점수에는 반영하지 않습니다.</li>
              </ul>
              <div className="logic-day-table">
                {result.decision.logic.dust.days.map((day) => (
                  <div key={day.label} className="logic-day-row logic-day-row--compact">
                    <span>{day.label}</span>
                    <span>{day.grade_label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="logic-block">
              <div className="logic-block-title">
                꽃가루 (기상청 꽃가루농도위험지수 · {result.decision.logic.pollen.region})
              </div>
              {result.decision.logic.pollen.available ? (
                <>
                  <ul className="logic-list">
                    <li>3일 최악 등급: {result.decision.logic.pollen.three_day_worst_label}</li>
                    <li>{result.decision.logic.pollen.season_note}</li>
                  </ul>
                  <div className="logic-day-table">
                    {result.decision.logic.pollen.days.map((day) => (
                      <div key={day.label} className="logic-day-row logic-day-row--compact">
                        <span>{day.label}</span>
                        <span>{day.grade_label}</span>
                        <span>{day.active_species_labels.join("·") || "-"}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="logic-note">{result.decision.logic.pollen.season_note}</p>
              )}
            </div>

            <h3 className="logic-subtitle">2. 점수 계산</h3>
            <p className="logic-note">시작 점수 {result.decision.logic.scoring.start}점에서 조건에 맞는 항목만 가감합니다.</p>
            <div className="logic-score-table">
              {result.decision.logic.scoring.steps.map((step) => (
                <div
                  key={step.rule}
                  className={`logic-score-row${step.applied ? " logic-score-row--applied" : " logic-score-row--skipped"}`}
                >
                  <span className="logic-score-rule">{step.rule}</span>
                  <span className="logic-score-delta">
                    {step.delta > 0 ? `+${step.delta}` : step.delta}점
                  </span>
                  <span className="logic-score-status">{step.applied ? "적용" : "해당 없음"}</span>
                </div>
              ))}
              <div className="logic-score-row logic-score-row--final">
                <span className="logic-score-rule">최종 점수</span>
                <span className="logic-score-delta">{result.decision.logic.scoring.final}점</span>
                <span className="logic-score-status">{result.decision.signal_label}</span>
              </div>
            </div>

            <h3 className="logic-subtitle">3. 신호등 기준</h3>
            <ul className="logic-list">
              {result.decision.logic.thresholds.map((item) => (
                <li key={item.signal}>
                  {item.signal === "green" && "🟢"}
                  {item.signal === "yellow" && "🟡"}
                  {item.signal === "red" && "🔴"}{" "}
                  {item.min_score !== undefined && item.max_score !== undefined
                    ? `${item.min_score}~${item.max_score}점`
                    : item.min_score !== undefined
                      ? `${item.min_score}점 이상`
                      : `${item.max_score}점 이하`}
                  : {item.label}
                </li>
              ))}
            </ul>


            <div className="logic-share-wrap">
              <ShareConclusionButton onClick={() => handleShareConclusion("logic")} />
              {shareNotice && shareNoticeSource === "logic" && (
                <p className="conclusion-share-notice">{shareNotice}</p>
              )}
            </div>
          </section>
          </>
          )}
        </>
      )}

      {result && showConclusionPopup && (
        <div className="conclusion-overlay" role="dialog" aria-modal="true" aria-labelledby="conclusion-title">
          <div className="conclusion-modal">
            <SignalIndicator signal={result.decision.signal} />
            <p className="conclusion-eyebrow">오늘의 결론</p>
            <h2 id="conclusion-title" className="conclusion-title">
              {result.decision.signal_label}
            </h2>
            <p className="conclusion-score">종합 점수 {result.decision.score}점</p>
            <div className="conclusion-actions">
              <div className="conclusion-share-wrap">
                <ShareConclusionButton onClick={() => handleShareConclusion("popup")} />
                {shareNotice && shareNoticeSource === "popup" && (
                  <p className="conclusion-share-notice">{shareNotice}</p>
                )}
              </div>
              <button type="button" className="conclusion-logic-link" onClick={openLogicSection}>
                점수 로직이 궁금하다면?
              </button>
            </div>
            <button
              type="button"
              className="conclusion-close-btn"
              onClick={closeConclusionPopup}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {!result && !loading && !error && <OnboardingGuide />}

      <p className="footer">
        데이터: 기상청 단기예보 · 대기질 예보 · 기상청 꽃가루농도위험지수
        (공공데이터포털)
      </p>
      <p className="footer-contact">
        문의사항 :{" "}
        <a href="mailto:forsmartonly@gmail.com">forsmartonly@gmail.com</a>
      </p>
    </main>
  );
}
