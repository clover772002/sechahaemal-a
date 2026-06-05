import math

from app.locations import PRESET_LOCATIONS

# 기상청 격자 ↔ 위경도 변환 (LCC DFS)
RE = 6371.00877
GRID = 5.0
SLAT1 = 30.0
SLAT2 = 60.0
OLON = 126.0
OLAT = 38.0
XO = 43
YO = 136


def _to_rad(deg: float) -> float:
    return deg * math.pi / 180.0


def _to_deg(rad: float) -> float:
    return rad * 180.0 / math.pi


def lat_lng_to_grid(lat: float, lng: float) -> tuple[int, int]:
    """위경도(WGS84)를 기상청 격자 좌표(nx, ny)로 변환합니다."""
    re = RE / GRID
    slat1 = _to_rad(SLAT1)
    slat2 = _to_rad(SLAT2)
    olon = _to_rad(OLON)
    olat = _to_rad(OLAT)

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    ra = math.tan(math.pi * 0.25 + _to_rad(lat) * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = _to_rad(lng) - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    x = int(ra * math.sin(theta) + XO + 0.5)
    y = int(ro - ra * math.cos(theta) + YO + 0.5)
    return x, y


def grid_to_lat_lng(nx: int, ny: int) -> tuple[float, float]:
    """격자 좌표를 위경도로 역변환합니다."""
    re = RE / GRID
    slat1 = _to_rad(SLAT1)
    slat2 = _to_rad(SLAT2)
    olon = _to_rad(OLON)
    olat = _to_rad(OLAT)

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    xn = nx - XO
    yn = ro - ny + YO
    ra = math.sqrt(xn * xn + yn * yn)
    if sn < 0.0:
        ra = -ra
    alat = math.pow((re * sf / ra), (1.0 / sn))
    alat = 2.0 * math.atan(alat) - math.pi * 0.5

    theta = 0.0 if xn == 0 else math.atan2(xn, yn)
    alon = theta / sn + olon

    return _to_deg(alat), _to_deg(alon)


def detect_region(lat: float, lng: float) -> str:
    regions = [
        ("서울", 37.41, 37.70, 126.76, 127.18),
        ("인천", 37.26, 37.65, 126.30, 126.89),
        ("경기", 36.93, 38.30, 126.47, 127.98),
        ("강원", 37.02, 38.61, 127.05, 129.46),
        ("충북", 36.26, 37.22, 127.31, 128.70),
        ("충남", 35.97, 37.06, 125.99, 127.68),
        ("대전", 36.17, 36.51, 127.25, 127.54),
        ("세종", 36.42, 36.60, 127.21, 127.37),
        ("전북", 35.27, 36.19, 126.42, 127.69),
        ("전남", 34.21, 35.90, 125.99, 127.59),
        ("광주", 35.07, 35.24, 126.68, 126.96),
        ("경북", 35.67, 37.52, 127.98, 129.61),
        ("대구", 35.68, 36.01, 128.35, 128.78),
        ("경남", 34.69, 35.89, 127.57, 129.30),
        ("울산", 35.33, 35.70, 129.04, 129.52),
        ("부산", 34.88, 35.40, 128.74, 129.32),
        ("제주", 33.19, 33.57, 126.15, 126.95),
    ]
    for name, lat_min, lat_max, lng_min, lng_max in regions:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return name
    return "서울"


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = _to_rad(lat2 - lat1)
    dlng = _to_rad(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(_to_rad(lat1)) * math.cos(_to_rad(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


# 프리셋 지역 대표 좌표 (근접 측정소 매칭용)
PRESET_COORDS: dict[str, tuple[float, float]] = {
    "pohang": (36.019, 129.343),
    "seoul": (37.566, 126.978),
    "busan": (35.233, 129.081),
    "daegu": (35.871, 128.601),
    "incheon": (37.456, 126.705),
    "gwangju": (35.160, 126.853),
    "daejeon": (36.350, 127.385),
    "jeju": (33.499, 126.531),
}


def find_weather_grid(lat: float, lng: float) -> tuple[int, int]:
    """가장 가까운 대표 격자(기상청 일별 예보 기준)를 반환합니다."""
    best = None
    best_dist = float("inf")

    for location in PRESET_LOCATIONS:
        coords = PRESET_COORDS.get(location.id)
        if not coords:
            continue
        dist = _haversine(lat, lng, coords[0], coords[1])
        if dist < best_dist:
            best_dist = dist
            best = location

    if best:
        return best.nx, best.ny
    return lat_lng_to_grid(lat, lng)


def find_nearest_station(lat: float, lng: float) -> dict:
    """가장 가까운 프리셋 측정소를 반환합니다."""
    best = None
    best_dist = float("inf")

    for location in PRESET_LOCATIONS:
        coords = PRESET_COORDS.get(location.id)
        if not coords:
            continue
        dist = _haversine(lat, lng, coords[0], coords[1])
        if dist < best_dist:
            best_dist = dist
            best = location

    if not best:
        best = PRESET_LOCATIONS[0]

    return {
        "station_name": best.station_name,
        "region": detect_region(lat, lng),
        "distance_km": round(best_dist, 1),
    }
