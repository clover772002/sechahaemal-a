const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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
}

export async function fetchNearbyCarWashes(
  lat: number,
  lng: number,
  radius = 3000,
): Promise<NearbyCarWashResponse> {
  const url = `${API_BASE}/api/car-wash/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "세차장을 불러오지 못했습니다." }));
    throw new Error(error.detail ?? "세차장을 불러오지 못했습니다.");
  }
  return response.json();
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** API 없이 카카오맵에서 세차장 검색 (폴백) */
export function buildKakaoMapSearchFallbackUrl(lat: number, lng: number): string {
  return `https://map.kakao.com/link/map/${lat},${lng},4`;
}
