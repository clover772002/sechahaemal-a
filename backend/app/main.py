import asyncio
import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.air_quality import fetch_air_quality, fetch_dust_forecast
from app.services.coordinates import detect_airkorea_region, find_nearest_station, lat_lng_to_grid
from app.services.decision import evaluate_car_wash
from app.services.pollen import fetch_pollen_forecast
from app.services.weather import (
    fetch_weather_forecast,
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


@app.get("/health")
async def health_check():
    return {"status": "ok"}


async def _build_rain_summary(nx: int, ny: int) -> dict:
    raw_forecast, forecast_meta = await fetch_weather_forecast(nx, ny)
    forecast = parse_forecast_items(raw_forecast)
    return summarize_rain_forecast(
        forecast["hours"],
        forecast.get("daily_meta"),
        forecast.get("slots"),
        forecast_meta,
    )


async def _fetch_current_air(station_name: str) -> dict:
    try:
        return await fetch_air_quality(station_name)
    except RuntimeError as exc:
        logger.warning("실시간 대기질 조회 실패(%s): %s", station_name, exc)
        return {
            "data_time": None,
            "pm10_value": "-",
            "pm10_grade": None,
            "pm10_grade_label": "측정 불가",
            "pm25_value": "-",
            "pm25_grade": None,
            "pm25_grade_label": "측정 불가",
            "unavailable_reason": str(exc),
        }


@app.get("/api/analyze")
async def analyze_location(
    lat: float = Query(..., ge=33.0, le=39.5, description="위도"),
    lng: float = Query(..., ge=124.0, le=132.0, description="경도"),
):
    try:
        nx, ny = lat_lng_to_grid(lat, lng)
        station_info = find_nearest_station(lat, lng)
        station_name = station_info["station_name"]
        region = station_info["region"]
        airkorea_region = detect_airkorea_region(lat, lng, region)

        rain_summary, dust_forecast, current_air, pollen_forecast = await asyncio.gather(
            _build_rain_summary(nx, ny),
            fetch_dust_forecast(airkorea_region, station_name),
            _fetch_current_air(station_name),
            fetch_pollen_forecast(region),
        )
        dust_forecast["forecast_meta"]["current_data_time"] = current_air.get("data_time")
        decision = evaluate_car_wash(rain_summary, dust_forecast, pollen_forecast)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("외부 API 호출 실패")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("분석 실패")
        raise HTTPException(status_code=500, detail="분석에 실패했습니다.") from exc

    return {
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
        "current_air": current_air,
        "decision": decision,
    }
