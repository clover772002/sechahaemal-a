export interface KmaPeriodForecast {
  pop: number;
  pop_display: string;
  tmp: number | null;
  tmp_display: string;
  sky: string;
  pty: string;
  sky_label: string;
  pty_label: string;
  weather_icon: string;
}

export interface KmaDailyColumn {
  label: string;
  date: string;
  date_title: string;
  is_today: boolean;
  am: KmaPeriodForecast;
  pm: KmaPeriodForecast;
}

export interface ForecastMeta {
  base_date: string;
  base_time: string;
  base_datetime: string;
  nx: number;
  ny: number;
  source: string;
  mid_tm_fc?: string;
  mid_tm_fc_display?: string;
  mid_land_reg_id?: string;
  mid_ta_reg_id?: string;
}

export interface RainDay {
  label: string;
  date: string;
  max_pop: number;
  avg_pop: number;
  has_rain: boolean;
  risk: "low" | "medium" | "high";
  risk_label: string;
}

export interface DustDay {
  label: string;
  grade: number;
  grade_label: string;
  data_time: string | null;
}

export interface Decision {
  score: number;
  signal: "green" | "yellow" | "red";
  signal_label: string;
  summary: string;
  reasons: string[];
  criteria: string[];
}

export interface AnalyzeResponse {
  location: {
    lat: number;
    lng: number;
    region: string;
    station_name: string;
    station_addr: string;
    grid: { nx: number; ny: number };
  };
  rain_forecast: {
    days: RainDay[];
    kma_daily: KmaDailyColumn[];
    forecast_meta: ForecastMeta;
    three_day_max_pop: number;
    three_day_avg_pop: number;
    rainy_day_count: number;
  };
  dust_forecast: {
    days: DustDay[];
    three_day_avg_grade: number;
    three_day_worst_grade: number;
    region: string;
  };
  current_air: {
    pm25_value: string;
    pm25_grade_label: string;
  };
  decision: Decision;
}
