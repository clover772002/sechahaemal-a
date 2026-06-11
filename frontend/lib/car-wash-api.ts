import { toFetchErrorMessage } from "./fetch-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const CAR_WASH_TIMEOUT_MS = 30000;

export interface CarWashPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  distance_m: number | null;
  navigate_url: string;
}

export interface NearbyCarWashResponse {
  items: CarWashPlace[];
  count: number;
  source?: "kakao" | "openstreetmap" | "mixed" | null;
  warning?: string | null;
  search_radius_m?: number;
}

export async function fetchNearbyCarWashes(
  lat: number,
  lng: number,
  radius = 5000,
): Promise<NearbyCarWashResponse> {
  const url = `${API_BASE}/api/car-wash/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(CAR_WASH_TIMEOUT_MS),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "세차장을 불러오지 못했습니다." }));
      throw new Error(error.detail ?? "세차장을 불러오지 못했습니다.");
    }
    return response.json();
  } catch (err) {
    throw new Error(toFetchErrorMessage(err, "세차장을 불러오지 못했습니다."));
  }
}

export function sortCarWashesByDistance(items: CarWashPlace[]): CarWashPlace[] {
  return [...items].sort((a, b) => {
    const aDistance = a.distance_m ?? Number.POSITIVE_INFINITY;
    const bDistance = b.distance_m ?? Number.POSITIVE_INFINITY;
    return aDistance - bDistance;
  });
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** 내 위치 → 세차장 자동차 길찾기 (출발·도착 포함) */
export function buildKakaoMapRoadUrl(
  fromLat: number,
  fromLng: number,
  toName: string,
  toLat: number,
  toLng: number,
): string {
  const from = encodeURIComponent("내 위치");
  const to = encodeURIComponent(toName);
  return `https://map.kakao.com/link/by/car/${from},${fromLat},${fromLng}/${to},${toLat},${toLng}`;
}

/** API 없이 카카오맵에서 세차장 검색 (폴백) */
export function buildKakaoMapSearchFallbackUrl(lat: number, lng: number): string {
  const keyword = encodeURIComponent("세차장");
  return `https://map.kakao.com/link/search/${keyword}/${lat},${lng}`;
}
