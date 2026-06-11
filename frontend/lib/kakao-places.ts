import type { CarWashPlace } from "./car-wash-api";
import { sortCarWashesByDistance } from "./car-wash-api";

const KAKAO_SDK_URL = "https://dapi.kakao.com/v2/maps/sdk.js";
const SEARCH_QUERIES = ["세차장", "셀프세차", "손세차"] as const;
const SEARCH_RADIUS_M = 10_000;

type KakaoPlaceDocument = {
  id: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  phone?: string;
  x: string;
  y: string;
  distance?: string;
};

type KakaoSdk = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => unknown;
    services: {
      Places: new () => {
        keywordSearch: (
          query: string,
          callback: (data: KakaoPlaceDocument[], status: string) => void,
          options: Record<string, unknown>,
        ) => void;
      };
      Status: { OK: string };
      SortBy: { DISTANCE: string };
    };
  };
};

declare global {
  interface Window {
    kakao?: KakaoSdk;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function getJavascriptKey(): string | null {
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim();
  return key || null;
}

function loadKakaoSdk(appKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저 환경이 아닙니다."));
  }
  if (window.kakao?.maps?.services) {
    return Promise.resolve();
  }
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${KAKAO_SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      const kakao = window.kakao;
      if (!kakao?.maps?.load) {
        reject(new Error("카카오 지도 SDK 초기화 실패"));
        return;
      }
      kakao.maps.load(() => resolve());
    };
    script.onerror = () => reject(new Error("카카오 지도 SDK 로드 실패"));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

function keywordSearch(
  kakao: KakaoSdk,
  query: string,
  lat: number,
  lng: number,
): Promise<KakaoPlaceDocument[]> {
  return new Promise((resolve) => {
    const places = new kakao.maps.services.Places();
    const center = new kakao.maps.LatLng(lat, lng);
    places.keywordSearch(
      query,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve(data);
          return;
        }
        resolve([]);
      },
      {
        location: center,
        radius: SEARCH_RADIUS_M,
        sort: kakao.maps.services.SortBy.DISTANCE,
        size: 15,
      },
    );
  });
}

function toCarWashPlace(doc: KakaoPlaceDocument): CarWashPlace | null {
  if (!doc.id) return null;
  const lat = Number.parseFloat(doc.y);
  const lng = Number.parseFloat(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const distanceRaw = doc.distance ? Number.parseInt(doc.distance, 10) : Number.NaN;
  return {
    id: doc.id,
    name: doc.place_name || "세차장",
    address: doc.road_address_name || doc.address_name || "",
    lat,
    lng,
    phone: doc.phone || null,
    distance_m: Number.isFinite(distanceRaw) ? distanceRaw : null,
    navigate_url: "",
  };
}

export function isKakaoPlacesSearchAvailable(): boolean {
  return getJavascriptKey() !== null;
}

export async function searchKakaoCarWashes(lat: number, lng: number): Promise<CarWashPlace[]> {
  const appKey = getJavascriptKey();
  if (!appKey) {
    return [];
  }

  await loadKakaoSdk(appKey);
  const kakao = window.kakao;
  if (!kakao?.maps?.services) {
    return [];
  }

  const merged = new Map<string, CarWashPlace>();
  for (const query of SEARCH_QUERIES) {
    const documents = await keywordSearch(kakao, query, lat, lng);
    for (const doc of documents) {
      const item = toCarWashPlace(doc);
      if (!item) continue;
      const existing = merged.get(item.id);
      if (
        !existing ||
        (item.distance_m !== null &&
          (existing.distance_m === null || item.distance_m < existing.distance_m))
      ) {
        merged.set(item.id, item);
      }
    }
  }

  return sortCarWashesByDistance([...merged.values()]).slice(0, 15);
}
