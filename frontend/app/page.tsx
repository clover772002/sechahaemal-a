"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import KmaDailyForecast from "@/components/KmaDailyForecast";
import { fetchAnalysis, getCurrentPosition, getLocationErrorMessage, LocationError } from "@/lib/api";
import type { AnalyzeResponse } from "@/lib/types";

const KMA_WEATHER_URL = "https://www.weather.go.kr/w/index.do";
const AIRKOREA_FORECAST_URL = "https://www.airkorea.or.kr/web/dustForecast?pMENU_NO=113";
const AIRKOREA_REALTIME_URL = "https://www.airkorea.or.kr/web/realSearch?pMENU_NO=97";

function DustGrade({ grade }: { grade: number }) {
  const labels = ["", "좋음", "보통", "나쁨", "매우나쁨"];
  return <>{labels[grade] ?? "보통"}</>;
}

function VerifyLink({
  href,
  label,
  imageSrc,
  imageAlt,
}: {
  href: string;
  label: string;
  imageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <a
      className="verify-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}에서 직접 확인`}
    >
      {imageSrc ? (
        <Image src={imageSrc} alt={imageAlt ?? label} width={120} height={28} className="verify-link-img" />
      ) : (
        <span className="verify-link-text">{label}</span>
      )}
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

  const allRainDaysRevealed = expandedRainDays.size >= 3;

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
              <VerifyLink
                href={KMA_WEATHER_URL}
                label="기상청 날씨누리"
                imageSrc="/kma-weather-nuri.png"
                imageAlt="기상청 날씨누리"
              />
            </div>
            <KmaDailyForecast
              columns={result.rain_forecast.kma_daily}
              expandedDays={expandedRainDays}
              onOpenDay={openRainDay}
              forecastMeta={result.rain_forecast.forecast_meta}
            />
            {allRainDaysRevealed && (
              <div className="summary-bar revealed">
                <span>
                  3일 평균 <strong>{result.rain_forecast.three_day_avg_pop}%</strong>
                </span>
                <span>
                  최대 <strong>{result.rain_forecast.three_day_max_pop}%</strong>
                </span>
                <span>비 예보 {result.rain_forecast.rainy_day_count}일</span>
              </div>
            )}
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
            <div className="dust-verify-meta">
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
                  className={`day-card dust${expandedDustDays.has(day.label) ? " expanded" : ""}`}
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
                        <div className="day-value dust-grade">
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
            <p className="signal-desc">{result.decision.summary}</p>
          </section>

          <section className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>
              판정 기준
            </div>
            <ul className="criteria-list">
              {result.decision.criteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="footer">
        데이터: 기상청 단기예보 · 에어코리아 대기오염/예보 (공공데이터포털)
      </p>
    </main>
  );
}
