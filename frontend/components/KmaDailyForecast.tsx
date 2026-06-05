import type { ForecastMeta, KmaDailyColumn } from "@/lib/types";

const WEATHER_ICONS: Record<string, string> = {
  sunny: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  rain_snow: "🌨️",
  sleet: "🌦️",
};

function WeatherIcon({ icon }: { icon: string }) {
  return <span className="kma-weather-icon">{WEATHER_ICONS[icon] ?? "☀️"}</span>;
}

function PeriodCells({
  column,
  row,
}: {
  column: KmaDailyColumn;
  row: "time" | "weather" | "temp" | "pop";
}) {
  if (row === "time") {
    return (
      <>
        <span>오전</span>
        <span>오후</span>
      </>
    );
  }

  if (row === "weather") {
    return (
      <>
        <WeatherIcon icon={column.am.weather_icon} />
        <WeatherIcon icon={column.pm.weather_icon} />
      </>
    );
  }

  if (row === "temp") {
    return (
      <>
        <span className="kma-temp am">{column.am.tmp_display}</span>
        <span className="kma-temp pm">{column.pm.tmp_display}</span>
      </>
    );
  }

  return (
    <>
      <span>{column.am.pop_display}</span>
      <span>{column.pm.pop_display}</span>
    </>
  );
}

export default function KmaDailyForecast({
  columns,
  expandedDays,
  onOpenDay,
  forecastMeta,
}: {
  columns: KmaDailyColumn[];
  expandedDays: Set<string>;
  onOpenDay: (label: string) => void;
  forecastMeta?: ForecastMeta;
}) {
  const rows: { key: "time" | "weather" | "temp" | "pop"; label: string }[] = [
    { key: "time", label: "시각" },
    { key: "weather", label: "날씨" },
    { key: "temp", label: "기온" },
    { key: "pop", label: "강수확률" },
  ];

  return (
    <div className="kma-daily">
      <div className="kma-daily-title-row">
        <div className="kma-daily-title">일별 예보</div>
        {forecastMeta && (
          <div className="kma-daily-meta">
            단기 격자 {forecastMeta.nx},{forecastMeta.ny} · {forecastMeta.base_datetime}
            {forecastMeta.mid_land_reg_id && (
              <>
                <br />
                중기 {forecastMeta.mid_land_reg_id}/{forecastMeta.mid_ta_reg_id} ·{" "}
                {forecastMeta.mid_tm_fc_display}
              </>
            )}
          </div>
        )}
      </div>
      <div className="kma-daily-table">
        <div className="kma-daily-row kma-daily-head">
          <div className="kma-daily-label">날짜</div>
          {columns.map((column) => (
            <button
              key={column.date}
              type="button"
              className={`kma-daily-col-head${column.is_today ? " today" : ""}`}
              onClick={() => onOpenDay(column.label)}
            >
              <div className="kma-date-title">{column.date_title}</div>
              <div className={`kma-day-label${column.label === "모레" ? " future" : ""}`}>
                {column.label}
              </div>
            </button>
          ))}
        </div>

        {rows.map((row) => (
          <div className="kma-daily-row" key={row.key}>
            <div className="kma-daily-label">{row.label}</div>
            {columns.map((column) => {
              const expanded = expandedDays.has(column.label);
              return (
                <div
                  key={`${column.date}-${row.key}`}
                  className={`kma-daily-cell${column.is_today ? " today" : ""}${expanded ? " expanded" : ""}`}
                >
                  <button
                    type="button"
                    className="kma-daily-cell-btn"
                    onClick={() => onOpenDay(column.label)}
                    aria-expanded={expanded}
                  >
                    {!expanded && <span className="kma-daily-overlay">클릭</span>}
                    <div className={`kma-period-grid${expanded ? " visible" : ""}`}>
                      <PeriodCells column={column} row={row.key} />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
