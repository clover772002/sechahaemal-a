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
  pop_rule?: string;
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

export interface DustForecastMeta {
  region: string;
  station_name: string;
  inform_code: string;
  data_time: string | null;
  current_data_time?: string | null;
  source: string;
  verify_forecast_hint: string;
  verify_realtime_hint: string;
}

export interface DustDay {
  label: string;
  grade: number;
  grade_label: string;
  data_time: string | null;
}

export interface PollenForecastMeta {
  region: string;
  area_no: string;
  data_time: string | null;
  source: string;
  season_note: string;
  verify_hint: string;
}

export interface PollenDay {
  label: string;
  grade: number;
  grade_label: string;
  active_species_labels: string[];
}

export interface DecisionScoreStep {
  rule: string;
  delta: number;
  applied: boolean;
}

export interface DecisionLogic {
  overview: string;
  rain: {
    source: string;
    pop_rule: string;
    three_day_max_pop: number;
    three_day_avg_pop: number;
    rainy_day_count: number;
    rainy_day_rule: string;
    days: Array<{
      label: string;
      max_pop: number;
      has_rain: boolean;
      counts_as_rainy: boolean;
    }>;
  };
  dust: {
    source: string;
    region: string;
    three_day_worst_grade: number;
    three_day_worst_label: string;
    three_day_avg_grade: number;
    days: Array<{ label: string; grade: number; grade_label: string }>;
  };
  pollen: {
    source: string;
    region: string;
    available: boolean;
    in_season: boolean;
    three_day_worst_grade: number | null;
    three_day_worst_label: string | null;
    season_note?: string;
    days: Array<{
      label: string;
      grade: number;
      grade_label: string;
      active_species_labels: string[];
    }>;
  };
  scoring: {
    start: number;
    steps: DecisionScoreStep[];
    final: number;
  };
  thresholds: Array<{
    signal: "green" | "yellow" | "red";
    min_score?: number;
    max_score?: number;
    label: string;
  }>;
}

export interface Decision {
  score: number;
  signal: "green" | "yellow" | "red";
  signal_label: string;
  summary: string;
  reasons: string[];
  logic: DecisionLogic;
}

export interface AnalyzeResponse {
  location: {
    lat: number;
    lng: number;
    region: string;
    airkorea_region?: string;
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
    forecast_meta: DustForecastMeta;
  };
  pollen_forecast: {
    days: PollenDay[];
    three_day_worst_grade: number | null;
    available: boolean;
    in_season: boolean;
    unavailable_reason?: string;
    region: string;
    forecast_meta: PollenForecastMeta;
  };
  current_air: {
    data_time?: string | null;
    pm25_value: string;
    pm25_grade_label: string;
  };
  decision: Decision;
}
