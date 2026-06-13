/** 온보딩 표시용 — backend decision.py 점수 규칙과 동일 */
const EFFECT_INDEX_RULES = [
  {
    label: "비",
    items: [
      { condition: "3일 내 비 없음 · 평균 강수 20% 이하", delta: "+5%p" },
      { condition: "3일 중 비 1일 예보", delta: "−15%p" },
      { condition: "3일 중 비 2일 이상", delta: "−30%p" },
      { condition: "최대 강수확률 60% 이상", delta: "−35%p" },
    ],
  },
  {
    label: "미세먼지",
    items: [
      { condition: "3일 예보 보통 이하", delta: "+5%p" },
      { condition: "3일 예보 나쁨", delta: "−15%p" },
      { condition: "3일 예보 매우나쁨", delta: "−25%p" },
    ],
  },
  {
    label: "꽃가루",
    items: [
      { condition: "3일 예보 보통 이하", delta: "+3%p" },
      { condition: "3일 예보 높음", delta: "−10%p" },
      { condition: "3일 예보 매우높음", delta: "−15%p" },
    ],
  },
] as const;

const EXAMPLE_GOOD = {
  label: "3일 내 비 없음 · 미세먼지 좋음 · 꽃가루 낮음",
  delta: "+13%p",
  note: "시작 100점에서 가산",
};

const EXAMPLE_BAD = {
  label: "최대 강수 60% · 미세먼지 나쁨",
  delta: "−50%p",
  note: "시작 100점에서 감산",
};

export function OnboardingGuide() {
  return (
    <section className="onboarding-guide">
      <section className="onboarding-header">
        <h2 className="onboarding-title">세차 효과 지수</h2>
        <p className="onboarding-lead">
          세차 직후 3일 동안 깨끗함이 유지될 가능성을 <strong>100점 만점 지수</strong>로
          비교합니다. 비·미세먼지·꽃가루 예보에 따라 아래처럼 <strong>%p</strong>(퍼센트포인트)가
          오르거나 내려갑니다.
        </p>
      </section>

      <ul className="onboarding-compare-list">
        {EFFECT_INDEX_RULES.map((group) => (
          <li key={group.label} className="onboarding-compare-item">
            <p className="onboarding-compare-label">{group.label}</p>
            <ul className="onboarding-rule-list">
              {group.items.map((item) => (
                <li key={item.condition} className="onboarding-rule-row">
                  <span className="onboarding-rule-delta">{item.delta}</span>
                  <span>{item.condition}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="onboarding-example">
        <p className="onboarding-example-title">예시</p>
        <p>
          <strong>{EXAMPLE_GOOD.delta}</strong> — {EXAMPLE_GOOD.label}
          <span className="onboarding-example-note"> ({EXAMPLE_GOOD.note})</span>
        </p>
        <p>
          <strong>{EXAMPLE_BAD.delta}</strong> — {EXAMPLE_BAD.label}
          <span className="onboarding-example-note"> ({EXAMPLE_BAD.note})</span>
        </p>
      </div>

      <p className="onboarding-summary">
        지수 70%p 이상이면 초록, 40~69%p는 노랑, 39%p 이하는 빨강입니다. 버튼을 누르면 내
        위치 예보로 계산합니다.
      </p>

      <p className="onboarding-disclaimer">
        %p는 예보 기반 지수이며 실제 차량 청결도를 측정한 값이 아닙니다. 예보는 확률·예측이며
        실제와 다를 수 있습니다.
      </p>
    </section>
  );
}
