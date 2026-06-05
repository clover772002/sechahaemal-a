"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { fetchAnalysis, getCurrentPosition, getLocationErrorMessage, LocationError } from "@/lib/api";
import type { AnalyzeResponse } from "@/lib/types";

const KMA_WEATHER_URL = "https://www.weather.go.kr/w/index.do";
const AIRKOREA_FORECAST_URL = "https://www.airkorea.or.kr/web/dustForecast?pMENU_NO=113";
const AIRKOREA_REALTIME_URL = "https://www.airkorea.or.kr/web/realSearch?pMENU_NO=97";

function DustGrade({ grade }: { grade: number }) {
  const labels = ["", "좋음", "보통", "나쁨", "매우나쁨"];
  return <>{labels[grade] ?? "보통"}</>;
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
  const { data: session, status } = useSession();
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [expandedRainDays, setExpandedRainDays] = useState<Set<string>>(() => new Set());
  const [expandedDustDays, setExpandedDustDays] = useState<Set<string>>(() => new Set());

  const openRainDay = (label: string) => {
    setExpandedRainDays((prev) => {
      if (prev.has(label)) return prev;
      const next = new Set(prev);
      next.add(label);
      return next;
    });
  };

  const openDustDay = (label: string) => {
    setExpandedDustDays((prev) => {
      if (prev.has(label)) return prev;
      const next = new Set(prev);
      next.add(label);
      return next;
    });
  };

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      const data = await fetchAnalysis(
        position.coords.latitude,
        position.coords.longitude,
      );
      setResult(data);
      setExpandedRainDays(new Set());
      setExpandedDustDays(new Set());
    } catch (err) {
      setResult(null);
      const isLocationError =
        err instanceof LocationError ||
        (err && typeof err === "object" && "code" in err);
      setNeedsLocation(Boolean(isLocationError));
      setError(getLocationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadAnalysis();
    }
  }, [status, loadAnalysis]);

  if (status === "loading") {
    return (
      <main>
        <div className="status">로그인 상태 확인 중...</div>
      </main>
    );
  }

  if (!session) {
    return (
      <main>
        <section className="brand">
          <h1>오늘 세차 할까?</h1>
          <p>날씨와 미세먼지로 알려드려요</p>
        </section>
        <section className="card login-card">
          <h2>Google로 시작하기</h2>
          <p>
            로그인 후 현재 위치를 자동으로 받아
            <br />
            오늘·내일·모레 날씨를 분석합니다.
          </p>
          <button className="google-btn" onClick={() => signIn("google")}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.203 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.004 8-11.303 8-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44c8.045 0 14.773-5.444 17.094-12.783z"/>
            </svg>
            Google 계정으로 로그인
          </button>
          <p className="footer" style={{ marginTop: 16 }}>
            로그인이 안 되면 frontend/.env.local 에 Google Client ID/Secret을 입력했는지 확인하세요.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <section className="brand">
          <h1>오늘 세차 할까?</h1>
          <p>{result ? `${result.location.region} · ${result.location.station_name}` : "내 위치 분석 중"}</p>
        </section>
        <div className="user-chip">
          {session.user?.image && (
            <img src={session.user.image} alt="" />
          )}
          <button
            onClick={() => signOut()}
            style={{ border: "none", background: "none", padding: 0, color: "inherit" }}
          >
            로그아웃
          </button>
        </div>
      </div>

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
                📍 위치 허용하기 / 다시 시도
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
      {loading && <div className="status">현재 위치 기준으로 분석 중...</div>}

      {result && !loading && (
        <>
          <section className="card">
            <div className="section-head">
              <div className="section-title">3일 강수예보</div>
              <div className="verify-links">
                <VerifyLink href={KMA_WEATHER_URL} label="기상청 날씨누리" />
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
              <div>
                예보 대조: 날씨누리 단기예보 → 시간별 강수확률 → 오늘·내일·모레 각 일자 최대값
              </div>
            </div>
            <div className="day-grid">
              {result.rain_forecast.days.map((day, index) => (
                <button
                  key={`${day.label}-${index}`}
                  type="button"
                  className={`day-card forecast${expandedRainDays.has(day.label) ? " expanded" : ""}`}
                  onClick={() => openRainDay(day.label)}
                  aria-expanded={expandedRainDays.has(day.label)}
                >
                  <div className="day-label">{day.label}</div>
                  <div className="day-card-content-zone">
                    {!expandedRainDays.has(day.label) && (
                      <span className="day-card-hint">클릭</span>
                    )}
                    <div className="day-card-body">
                      <div className="day-card-inner">
                        <div className="day-value forecast-grade">{day.max_pop}%</div>
                        <div className="day-sub">강수확률</div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="summary-bar">
              <span>3일 평균 {result.rain_forecast.three_day_avg_pop}%</span>
              <span>최대 {result.rain_forecast.three_day_max_pop}%</span>
              <span>비 예보 {result.rain_forecast.rainy_day_count}일</span>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div className="section-title">3일 초미세먼지 예보</div>
              <div className="verify-links">
                <VerifyLink
                  href={AIRKOREA_FORECAST_URL}
                  label={`예보(${result.dust_forecast.forecast_meta.region})`}
                />
                <VerifyLink
                  href={AIRKOREA_REALTIME_URL}
                  label={`실시간(${result.location.station_name})`}
                />
              </div>
            </div>
            <div className="forecast-verify-meta">
              <div>
                {result.dust_forecast.forecast_meta.source}
                {result.dust_forecast.forecast_meta.data_time && (
                  <> · 발표 {result.dust_forecast.forecast_meta.data_time}</>
                )}
              </div>
              <div>예보 대조: {result.dust_forecast.forecast_meta.verify_forecast_hint}</div>
              <div>실시간 대조: {result.dust_forecast.forecast_meta.verify_realtime_hint}</div>
            </div>
            <div className="day-grid">
              {result.dust_forecast.days.map((day, index) => (
                <button
                  key={`${day.label}-${index}`}
                  type="button"
                  className={`day-card forecast${expandedDustDays.has(day.label) ? " expanded" : ""}`}
                  onClick={() => openDustDay(day.label)}
                  aria-expanded={expandedDustDays.has(day.label)}
                >
                  <div className="day-label">{day.label}</div>
                  <div className="day-card-content-zone">
                    {!expandedDustDays.has(day.label) && (
                      <span className="day-card-hint">클릭</span>
                    )}
                    <div className="day-card-body">
                      <div className="day-card-inner">
                        <div className="day-value forecast-grade">
                          <DustGrade grade={day.grade} />
                        </div>
                        <div className="day-sub">PM2.5 예보</div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="summary-bar">
              <span>
                현재 {result.current_air.pm25_value} ㎍/㎥
                {result.current_air.data_time && (
                  <> ({result.current_air.data_time})</>
                )}
              </span>
              <span>현재 {result.current_air.pm25_grade_label}</span>
            </div>
          </section>

          <section className="card signal-card">
            <div className={`signal-light ${result.decision.signal}`}>
              {result.decision.signal === "green" && "🟢"}
              {result.decision.signal === "yellow" && "🟡"}
              {result.decision.signal === "red" && "🔴"}
            </div>
            <h2 className="signal-title">{result.decision.signal_label}</h2>
            <p className="signal-desc">
              종합 점수 {result.decision.score}점 · {result.decision.summary}
            </p>
          </section>

          <section className="card decision-logic-card">
            <div className="section-title" style={{ marginBottom: 12 }}>
              최종 판정 로직
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
                초미세먼지 (에어코리아 PM2.5 · {result.decision.logic.dust.region})
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

            <h3 className="logic-subtitle">2. 점수 계산</h3>
            <p className="logic-note">시작 점수 {result.decision.logic.scoring.start}점에서 조건에 맞는 항목만 가감합니다.</p>
            <div className="logic-score-table">
              {result.decision.logic.scoring.steps.map((step) => (
                <div
                  key={step.rule}
                  className={`logic-score-row${step.applied ? " logic-score-row--applied" : ""}`}
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

            {result.decision.reasons.length > 0 && (
              <>
                <h3 className="logic-subtitle">4. 이번 위치에 적용된 요인</h3>
                <ul className="logic-list logic-reasons">
                  {result.decision.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}

      <p className="footer">
        데이터: 기상청 단기예보 · 에어코리아 대기오염/예보 (공공데이터포털)
      </p>
    </main>
  );
}
