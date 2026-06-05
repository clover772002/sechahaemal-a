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
    Location(id="busan", name="부산 (부산대)", nx=98, ny=76, station_name="부산대"),
    Location(id="daegu", name="대구 (대구)", nx=89, ny=90, station_name="대구"),
    Location(id="incheon", name="인천 (연수구)", nx=55, ny=124, station_name="연수구"),
    Location(id="gwangju", name="광주 (광주)", nx=58, ny=74, station_name="광주"),
    Location(id="daejeon", name="대전 (대덕구)", nx=67, ny=100, station_name="대덕구"),
    Location(id="jeju", name="제주 (제주)", nx=52, ny=38, station_name="제주"),
]


def get_location(location_id: str) -> Location | None:
    for location in PRESET_LOCATIONS:
        if location.id == location_id:
            return location
    return None
