TRAFFIC_LABELS = {
    "green": "지금 세차하기 좋아요",
    "yellow": "세차해도 그럭저럭",
    "red": "세차 보류 추천",
}

DUST_LABELS = {1: "좋음", 2: "보통", 3: "나쁨", 4: "매우나쁨"}
POLLEN_LABELS = {0: "낮음", 1: "보통", 2: "높음", 3: "매우높음"}

RAINY_DAY_RULE = "해당 일자 최대 강수확률 40% 이상 또는 강수 형태(비·눈 등) 예보"


def evaluate_car_wash(rain_summary: dict, dust_forecast: dict, pollen_forecast: dict | None = None) -> dict:
    score = 100
    reasons: list[str] = []
    steps: list[dict] = []

    rainy_days = rain_summary["rainy_day_count"]
    max_pop = rain_summary["three_day_max_pop"]
    avg_pop = rain_summary["three_day_avg_pop"]
    worst_dust = dust_forecast["three_day_worst_grade"]
    pollen_forecast = pollen_forecast or {}
    pollen_available = pollen_forecast.get("available", False)
    worst_pollen = pollen_forecast.get("three_day_worst_grade")
    pop_rule = rain_summary.get("forecast_meta", {}).get("pop_rule", "일자별 시간별 강수확률 최대값")
    dust_region = dust_forecast.get("region", "")
    pollen_region = pollen_forecast.get("region", "")

    def apply(rule: str, delta: int, condition: bool, reason: str | None = None) -> None:
        nonlocal score
        if condition:
            score += delta
            steps.append({"rule": rule, "delta": delta, "applied": True})
            if reason:
                reasons.append(reason)
        else:
            steps.append({"rule": rule, "delta": delta, "applied": False})

    apply(
        f"3일 중 최대 강수예보 60% 이상 (−35점)",
        -35,
        max_pop >= 60,
        f"3일 중 최대 강수예보가 {max_pop}%로 높습니다.",
    )
    apply(
        f"3일 중 비 예보 2일 이상 (−30점)",
        -30,
        rainy_days >= 2,
        f"3일 중 {rainy_days}일 비 올 가능성이 있습니다.",
    )
    apply(
        f"3일 중 비 예보 1일 (−15점)",
        -15,
        rainy_days == 1,
        "3일 중 1일 비 올 가능성이 있습니다.",
    )
    apply(
        f"3일 평균 강수예보 40% 이상 (−15점)",
        -15,
        avg_pop >= 40,
        f"3일 평균 강수예보가 {avg_pop}%입니다.",
    )
    apply(
        f"3일 평균 강수예보 20% 이하 (+5점)",
        +5,
        avg_pop <= 20,
        f"3일 평균 강수예보가 {avg_pop}%로 낮습니다.",
    )
    apply(
        f"초미세먼지 예보 '매우나쁨' (−25점)",
        -25,
        worst_dust >= 4,
        "초미세먼지 예보가 매우 나쁩니다.",
    )
    apply(
        f"초미세먼지 예보 '나쁨' (−15점)",
        -15,
        worst_dust == 3,
        "초미세먼지 예보가 나쁩니다.",
    )
    apply(
        f"초미세먼지 예보 '보통' 이하 (+5점)",
        +5,
        worst_dust <= 2,
        "초미세먼지 예보가 양호합니다.",
    )
    if pollen_available and worst_pollen is not None:
        apply(
            f"꽃가루 예보 '매우높음' (−15점)",
            -15,
            worst_pollen >= 3,
            "꽃가루 위험지수가 매우 높습니다.",
        )
        apply(
            f"꽃가루 예보 '높음' (−10점)",
            -10,
            worst_pollen == 2,
            "꽃가루 위험지수가 높습니다.",
        )
        apply(
            f"꽃가루 예보 '보통' 이하 (+3점)",
            +3,
            worst_pollen <= 1,
            "꽃가루 위험지수가 낮습니다.",
        )

    score = max(0, min(100, score))

    if score >= 70:
        signal = "green"
    elif score >= 40:
        signal = "yellow"
    else:
        signal = "red"

    rain_days_detail = [
        {
            "label": d["label"],
            "max_pop": d["max_pop"],
            "has_rain": d["has_rain"],
            "counts_as_rainy": d["max_pop"] >= 40 or d["has_rain"],
        }
        for d in rain_summary.get("days", [])
    ]

    dust_days_detail = [
        {"label": d["label"], "grade": d["grade"], "grade_label": d["grade_label"]}
        for d in dust_forecast.get("days", [])
    ]

    pollen_days_detail = [
        {
            "label": d["label"],
            "grade": d["grade"],
            "grade_label": d["grade_label"],
            "active_species_labels": d.get("active_species_labels", []),
        }
        for d in pollen_forecast.get("days", [])
    ]

    overview_parts = [
        "강수(기상청 단기예보)와 초미세먼지(에어코리아 PM2.5 권역 예보)",
    ]
    if pollen_available:
        overview_parts.append("꽃가루(기상청 꽃가루농도위험지수)")
    overview_parts.append(
        "를 각각 점수로 환산한 뒤 합산해 신호등을 정합니다. "
        "현재 초미세먼지 실측값은 참고용이며 판정에는 쓰지 않습니다."
    )

    return {
        "score": score,
        "signal": signal,
        "signal_label": TRAFFIC_LABELS[signal],
        "summary": TRAFFIC_LABELS[signal],
        "reasons": reasons,
        "logic": {
            "overview": "".join(overview_parts),
            "rain": {
                "source": "기상청 단기예보(getVilageFcst)",
                "pop_rule": pop_rule,
                "three_day_max_pop": max_pop,
                "three_day_avg_pop": avg_pop,
                "rainy_day_count": rainy_days,
                "rainy_day_rule": RAINY_DAY_RULE,
                "days": rain_days_detail,
            },
            "dust": {
                "source": "에어코리아 대기질예보통보(PM25)",
                "region": dust_region,
                "three_day_worst_grade": worst_dust,
                "three_day_worst_label": DUST_LABELS.get(worst_dust, "보통"),
                "three_day_avg_grade": dust_forecast.get("three_day_avg_grade"),
                "days": dust_days_detail,
            },
            "pollen": {
                "source": pollen_forecast.get("forecast_meta", {}).get(
                    "source", "기상청 꽃가루농도위험지수"
                ),
                "region": pollen_region,
                "available": pollen_available,
                "in_season": pollen_forecast.get("in_season", False),
                "three_day_worst_grade": worst_pollen,
                "three_day_worst_label": POLLEN_LABELS.get(worst_pollen, None)
                if worst_pollen is not None
                else None,
                "season_note": pollen_forecast.get("forecast_meta", {}).get("season_note"),
                "days": pollen_days_detail,
            },
            "scoring": {
                "start": 100,
                "steps": steps,
                "final": score,
            },
            "thresholds": [
                {"signal": "green", "min_score": 70, "label": TRAFFIC_LABELS["green"]},
                {"signal": "yellow", "min_score": 40, "max_score": 69, "label": TRAFFIC_LABELS["yellow"]},
                {"signal": "red", "max_score": 39, "label": TRAFFIC_LABELS["red"]},
            ],
        },
    }
