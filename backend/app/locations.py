from pydantic import BaseModel


class Location(BaseModel):
    id: str
    name: str
    nx: int
    ny: int
    station_name: str


PRESET_LOCATIONS: list[Location] = [
    Location(id="pohang", name="포항 (제철동)", nx=102, ny=85, station_name="제철동"),
    Location(id="seoul", name="서울 (종로구)", nx=60, ny=127, station_name="종로구"),
    Location(id="busan", name="부산 (부산항)", nx=98, ny=76, station_name="부산항"),
    Location(id="daegu", name="대구 (중구)", nx=89, ny=90, station_name="중구"),
    Location(id="incheon", name="인천 (구월동)", nx=55, ny=124, station_name="구월동"),
    Location(id="gwangju", name="광주 (서석동)", nx=58, ny=74, station_name="서석동"),
    Location(id="daejeon", name="대전 (문평동)", nx=67, ny=100, station_name="문평동"),
    Location(id="jeju", name="제주 (연동)", nx=52, ny=38, station_name="연동"),
]


def get_location(location_id: str) -> Location | None:
    for location in PRESET_LOCATIONS:
        if location.id == location_id:
            return location
    return None
