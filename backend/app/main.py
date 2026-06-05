import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.air_quality import fetch_air_quality, fetch_dust_forecast
from app.services.coordinates import find_nearest_station, find_weather_grid
from app.services.decision import evaluate_car_wash
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


@app.get("/api/analyze")
async def analyze_location(
    lat: float = Query(..., ge=33.0, le=39.5, description="위도"),
    lng: float = Query(..., ge=124.0, le=132.0, description="경도"),
):
    try:
        nx, ny = find_weather_grid(lat, lng)
        station_info = find_nearest_station(lat, lng)
        station_name = station_info["station_name"]
        region = station_info["region"]

        raw_forecast = await fetch_weather_forecast(nx, ny)
        forecast = parse_forecast_items(raw_forecast)
        rain_summary = summarize_rain_forecast(forecast["hours"], forecast.get("daily_meta"))

        dust_forecast = await fetch_dust_forecast(region)
        current_air = await fetch_air_quality(station_name)
        decision = evaluate_car_wash(rain_summary, dust_forecast)
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
            "station_name": station_name,
            "distance_km": station_info["distance_km"],
            "grid": {"nx": nx, "ny": ny},
        },
        "rain_forecast": rain_summary,
        "dust_forecast": dust_forecast,
        "current_air": current_air,
        "decision": decision,
    }
