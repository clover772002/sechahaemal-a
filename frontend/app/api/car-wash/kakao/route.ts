import { NextRequest, NextResponse } from "next/server";

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const SEARCH_QUERIES = ["세차장", "셀프세차", "손세차"] as const;
const SEARCH_RADIUS_M = 10_000;

type KakaoDocument = {
  id: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  phone?: string;
  x: string;
  y: string;
  distance?: string;
};

function buildNavigateUrl(name: string, lat: number, lng: number, fromLat: number, fromLng: number) {
  const from = encodeURIComponent("내 위치");
  const to = encodeURIComponent(name);
  return `https://map.kakao.com/link/by/car/${from},${fromLat},${fromLng}/${to},${lat},${lng}`;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  const latRaw = request.nextUrl.searchParams.get("lat");
  const lngRaw = request.nextUrl.searchParams.get("lng");

  if (!apiKey) {
    return NextResponse.json({ items: [], count: 0, source: null, configured: false });
  }
  if (!latRaw || !lngRaw) {
    return NextResponse.json({ error: "lat, lng가 필요합니다." }, { status: 400 });
  }

  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "좌표가 올바르지 않습니다." }, { status: 400 });
  }

  const merged = new Map<string, Record<string, unknown>>();
  let lastStatus = 0;

  for (const query of SEARCH_QUERIES) {
    const url = new URL(KAKAO_KEYWORD_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("radius", String(SEARCH_RADIUS_M));
    url.searchParams.set("sort", "distance");
    url.searchParams.set("size", "15");

    try {
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        cache: "no-store",
      });
      lastStatus = response.status;
      if (!response.ok) continue;

      const payload = (await response.json()) as { documents?: KakaoDocument[] };
      for (const doc of payload.documents ?? []) {
        if (!doc.id) continue;
        const placeLat = Number.parseFloat(doc.y);
        const placeLng = Number.parseFloat(doc.x);
        if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) continue;

        const distanceParsed = doc.distance ? Number.parseInt(doc.distance, 10) : Number.NaN;
        const distanceM = Number.isFinite(distanceParsed)
          ? distanceParsed
          : haversineM(lat, lng, placeLat, placeLng);
        const name = doc.place_name || "세차장";

        const item = {
          id: doc.id,
          name,
          address: doc.road_address_name || doc.address_name || "",
          lat: placeLat,
          lng: placeLng,
          phone: doc.phone || null,
          distance_m: distanceM,
          navigate_url: buildNavigateUrl(name, placeLat, placeLng, lat, lng),
          source: "kakao",
        };

        const existing = merged.get(doc.id);
        if (
          !existing ||
          (typeof item.distance_m === "number" &&
            (existing.distance_m === null ||
              (typeof existing.distance_m === "number" && item.distance_m < existing.distance_m)))
        ) {
          merged.set(doc.id, item);
        }
      }
    } catch {
      continue;
    }
  }

  const items = [...merged.values()].sort(
    (a, b) => (a.distance_m as number) - (b.distance_m as number),
  ).slice(0, 15);

  if (items.length === 0 && (lastStatus === 401 || lastStatus === 403)) {
    return NextResponse.json({
      items: [],
      count: 0,
      source: null,
      configured: true,
      error: "카카오 API 키 또는 로컬 API 설정을 확인해 주세요.",
    });
  }

  return NextResponse.json({
    items,
    count: items.length,
    source: items.length > 0 ? "kakao" : null,
    configured: true,
    search_radius_m: SEARCH_RADIUS_M,
  });
}
