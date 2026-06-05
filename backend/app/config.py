from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    public_data_api_key: str = ""
    weather_api_url: str = (
        "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
    )
    dust_api_url: str = (
        "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
    )
    nearby_station_api_url: str = (
        "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getNearbyMsrstnList"
    )
    dust_forecast_api_url: str = (
        "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth"
    )
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )

    def get_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
