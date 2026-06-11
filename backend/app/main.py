import asyncio
import logging
import time

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.air_quality import fetch_air_quality, fetch_dust_forecast
from app.services.cache_store import get_cached, set_cached
from app.services.coordinates import detect_airkorea_region, find_nearest_station, lat_lng_to_grid
from app.services.decision import evaluate_car_wash
from app.services.pollen import fetch_pollen_forecast
from app.services.pollen import season_note
from app.services.car_wash_places import find_nearby_car_washes
from app.services.weather import (
    fetch_weather_forecast,
    kst_now,
    parse_forecast_items,
    summarize_rain_forecast,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="오늘 세차 할까? API",
    description="현재 위치 기반 세차 적기 판단 API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANALYZE_CACHE_TTL_SECONDS = 180
CAR_WASH_CACHE_TTL_SECONDS = 300
POLLEN_TIMEOUT_SECONDS = 4.0
UNAVAILABLE_CURRENT_AIR = {
    "data_time": None,
    "pm10_value": "-",
    "pm10_grade": None,
    "pm10_grade_label": "측정 불가",
    "pm25_value": "-",
    "pm25_grade": None,
    "pm25_grade_label": "측정 불가",
}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


def _car_wash_cache_key(lat: float, lng: float, radius: int) -> str:
    return f"car_wash:{round(lat, 3)}:{round(lng, 3)}:{radius}"


@app.get("/api/car-wash/nearby")
async def car_wash_nearby(
    lat: float = Query(..., ge=33.0, le=39.5),
    lng: float = Query(..., ge=124.0, le=132.0),
    radius: int = Query(5000, ge=500, le=10000),
):
    cache_key = _car_wash_cache_key(lat, lng, radius)
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        response = await find_nearby_car_washes(lat, lng, radius)
        if response.get("count", 0) > 0:
            set_cached(cache_key, response, CAR_WASH_CACHE_TTL_SECONDS)
        return response
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("세차장 검색 실패")
        raise HTTPException(status_code=502, detail="세차장 검색에 실패했습니다.") from exc


async def _build_rain_summary(nx: int, ny: int) -> dict:
    raw_forecast, forecast_meta = await fetch_weather_forecast(nx, ny)
    forecast = parse_forecast_items(raw_forecast)
    return summarize_rain_forecast(
        forecast["hours"],
        forecast.get("daily_meta"),
        forecast.get("slots"),
        forecast_meta,
    )


async def _fetch_pollen_with_timeout(region: str) -> dict:
    try:
        return await asyncio.wait_for(
            fetch_pollen_forecast(region),
            timeout=POLLEN_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        logger.warning("꽃가루 예보 조회 시간 초과(%ss)", POLLEN_TIMEOUT_SECONDS)
        now_month = kst_now().month
        return {
            "days": [],
            "three_day_worst_grade": None,
            "available": False,
            "in_season": 4 <= now_month <= 6 or 8 <= now_month <= 10,
            "unavailable_reason": "꽃가루 예보 응답이 지연되어 생략했습니다.",
            "region": region,
            "forecast_meta": {
                "region": region,
                "data_time": None,
                "source": "기상청 꽃가루농도위험지수",
                "season_note": season_note(now_month),
            },
        }


def _analyze_cache_key(nx: int, ny: int) -> str:
    return f"analyze:{nx}:{ny}"


@app.get("/api/current-air")
async def current_air(station_name: str = Query(..., min_length=1)):
    try:
        return await fetch_air_quality(station_name)
    except RuntimeError as exc:
        logger.warning("실시간 대기질 조회 실패(%s): %s", station_name, exc)
        return {**UNAVAILABLE_CURRENT_AIR, "unavailable_reason": str(exc)}


@app.get("/api/analyze")
async def analyze_location(
    lat: float = Query(..., ge=33.0, le=39.5, description="위도"),
    lng: float = Query(..., ge=124.0, le=132.0, description="경도"),
):
    try:
        nx, ny = lat_lng_to_grid(lat, lng)
        cache_key = _analyze_cache_key(nx, ny)
        cached_response = get_cached(cache_key)
        if cached_response is not None:
            logger.info("analyze cache hit nx=%s ny=%s", nx, ny)
            return cached_response

        started = time.perf_counter()
        station_info = find_nearest_station(lat, lng)
        station_name = station_info["station_name"]
        region = station_info["region"]
        airkorea_region = detect_airkorea_region(lat, lng, region)

        async def timed(label: str, coro):
            task_started = time.perf_counter()
            result = await coro
            logger.info("analyze %s %.0fms", label, (time.perf_counter() - task_started) * 1000)
            return result

        rain_summary, dust_forecast, pollen_forecast = await asyncio.gather(
            timed("rain", _build_rain_summary(nx, ny)),
            timed("dust", fetch_dust_forecast(airkorea_region, station_name)),
            timed("pollen", _fetch_pollen_with_timeout(region)),
        )

        logger.info("analyze total %.0fms", (time.perf_counter() - started) * 1000)

        dust_forecast["forecast_meta"]["current_data_time"] = None
        decision = evaluate_car_wash(rain_summary, dust_forecast, pollen_forecast)

        response = {
            "location": {
                "lat": lat,
                "lng": lng,
                "region": region,
                "airkorea_region": airkorea_region,
                "station_name": station_name,
                "distance_km": station_info["distance_km"],
                "grid": {"nx": nx, "ny": ny},
            },
            "rain_forecast": rain_summary,
            "dust_forecast": dust_forecast,
            "pollen_forecast": pollen_forecast,
            "current_air": {**UNAVAILABLE_CURRENT_AIR, "loading": True},
            "decision": decision,
        }
        set_cached(cache_key, response, ANALYZE_CACHE_TTL_SECONDS)
        return response
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("외부 API 호출 실패")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("분석 실패")
        raise HTTPException(status_code=500, detail="분석에 실패했습니다.") from exc
