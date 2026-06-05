TRAFFIC_LABELS = {
    "green": "지금 세차하기 좋아요",
    "yellow": "세차해도 그럭저럭",
    "red": "세차 보류 추천",
}

CRITERIA = [
    "3일 중 강수예보 60% 이상이 하루라도 있으면 빨간불 가중",
    "3일 중 비 예보가 2일 이상이면 빨간불",
    "3일 평균 강수예보 40% 이상이면 노란불 이상",
    "초미세먼지 예보가 '나쁨' 이상이면 노란불 이상",
    "3일 모두 강수예보 30% 미만 + 초미세먼지 '보통' 이하면 초록불",
]


def evaluate_car_wash(rain_summary: dict, dust_forecast: dict) -> dict:
    score = 100
    reasons: list[str] = []

    rainy_days = rain_summary["rainy_day_count"]
    max_pop = rain_summary["three_day_max_pop"]
    avg_pop = rain_summary["three_day_avg_pop"]
    worst_dust = dust_forecast["three_day_worst_grade"]

    if max_pop >= 60:
        score -= 35
        reasons.append(f"3일 중 최대 강수예보가 {max_pop}%로 높습니다.")
    if rainy_days >= 2:
        score -= 30
        reasons.append(f"3일 중 {rainy_days}일 비 올 가능성이 있습니다.")
    elif rainy_days == 1:
        score -= 15
        reasons.append("3일 중 1일 비 올 가능성이 있습니다.")

    if avg_pop >= 40:
        score -= 15
        reasons.append(f"3일 평균 강수예보가 {avg_pop}%입니다.")
    elif avg_pop <= 20:
        score += 5
        reasons.append(f"3일 평균 강수예보가 {avg_pop}%로 낮습니다.")

    if worst_dust >= 4:
        score -= 25
        reasons.append("초미세먼지 예보가 매우 나쁩니다.")
    elif worst_dust >= 3:
        score -= 15
        reasons.append("초미세먼지 예보가 나쁩니다.")
    elif worst_dust <= 2:
        score += 5
        reasons.append("초미세먼지 예보가 양호합니다.")

    score = max(0, min(100, score))

    if score >= 70:
        signal = "green"
    elif score >= 40:
        signal = "yellow"
    else:
        signal = "red"

    return {
        "score": score,
        "signal": signal,
        "signal_label": TRAFFIC_LABELS[signal],
        "summary": TRAFFIC_LABELS[signal],
        "reasons": reasons,
        "criteria": CRITERIA,
    }
