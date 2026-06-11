"use client";

import { useEffect, useState } from "react";
import {
  buildKakaoMapSearchFallbackUrl,
  fetchNearbyCarWashes,
  formatDistance,
  type CarWashPlace,
} from "@/lib/car-wash-api";

type NearbyCarWashSheetProps = {
  lat: number;
  lng: number;
  onClose: () => void;
};

export function NearbyCarWashSheet({ lat, lng, onClose }: NearbyCarWashSheetProps) {
  const [items, setItems] = useState<CarWashPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchNearbyCarWashes(lat, lng)
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "세차장을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <section className="car-wash-sheet" aria-labelledby="car-wash-title">
      <div className="car-wash-sheet-head">
        <h2 id="car-wash-title" className="car-wash-sheet-title">
          가까운 세차장
        </h2>
        <button type="button" className="car-wash-sheet-close" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>

      {loading && <p className="car-wash-sheet-status">주변 세차장 찾는 중...</p>}
      {error && (
        <div className="car-wash-sheet-fallback">
          <p className="car-wash-sheet-error">{error}</p>
          <a
            className="car-wash-fallback-btn"
            href={buildKakaoMapSearchFallbackUrl(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오맵에서 직접 찾기
          </a>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="car-wash-sheet-status">근처에 세차장을 찾지 못했어요.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="car-wash-list">
          {items.map((place) => (
            <li key={place.id} className="car-wash-item">
              <div className="car-wash-item-body">
                <p className="car-wash-item-name">{place.name}</p>
                {place.address && <p className="car-wash-item-address">{place.address}</p>}
                <div className="car-wash-item-meta">
                  {place.distance_m !== null && (
                    <span>{formatDistance(place.distance_m)}</span>
                  )}
                  {place.phone && <span>{place.phone}</span>}
                </div>
              </div>
              <a
                className="car-wash-navigate-btn"
                href={place.navigate_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                길찾기
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
