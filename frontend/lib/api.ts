import type { AnalyzeResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const ANALYSIS_TIMEOUT_MS = 20000;
const CURRENT_AIR_TIMEOUT_MS = 10000;

export type CurrentAirResponse = AnalyzeResponse["current_air"];

export async function fetchAnalysis(lat: number, lng: number): Promise<AnalyzeResponse> {
  const url = `${API_BASE}/api/analyze?lat=${lat}&lng=${lng}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "분석에 실패했습니다." }));
      throw new Error(error.detail ?? "분석에 실패했습니다.");
    }
    return response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("예보 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw err;
  }
}

export async function fetchCurrentAir(stationName: string): Promise<CurrentAirResponse> {
  const url = `${API_BASE}/api/current-air?station_name=${encodeURIComponent(stationName)}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(CURRENT_AIR_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error("현재 대기질을 불러오지 못했습니다.");
  }
  return response.json();
}

export class LocationError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "LocationError";
  }
}

export function getLocationErrorMessage(err: unknown): string {
  const code =
    err instanceof LocationError
      ? err.code
      : err && typeof err === "object" && "code" in err
        ? Number((err as GeolocationPositionError).code)
        : null;

  if (code === 1) {
    return "위치 권한이 거부되었습니다. 아래 '위치 허용하기'를 누르거나 브라우저 주소창 옆 자물쇠 → 위치 → 허용으로 변경해 주세요.";
  }
  if (code === 2) {
    return "현재 위치를 확인할 수 없습니다. GPS/Wi-Fi를 켠 뒤 다시 시도해 주세요.";
  }
  if (code === 3) {
    return "위치 허용 팝업이 늦게 뜨거나 응답이 지연됐습니다. 아래 버튼을 다시 눌러 주세요.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "위치 정보를 가져오지 못했습니다.";
}

type PositionOptions = {
  timeout?: number;
};

function requestCurrentPosition(timeout: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new LocationError(
          0,
          "이 브라우저는 위치 정보를 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.",
        ),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        reject(new LocationError(error.code, getLocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: false,
        timeout,
        maximumAge: 300000,
      },
    );
  });
}

export async function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  const timeout = options?.timeout ?? 30000;

  try {
    return await requestCurrentPosition(timeout);
  } catch (err) {
    if (err instanceof LocationError && err.code === 3) {
      return requestCurrentPosition(timeout);
    }
    throw err;
  }
}
