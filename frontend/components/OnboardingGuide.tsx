const COMPARE_ITEMS = [
  {
    label: "비",
    bad: "세차 직후 물때·얼룩이 생기기 쉽습니다.",
    good: "비 없으면 청결이 오래 갑니다.",
  },
  {
    label: "미세먼지",
    bad: "공기 중 먼지가 곧 다시 달라붙습니다.",
    good: "먼지 없으면 청결이 오래 갑니다.",
  },
  {
    label: "꽃가루",
    bad: "외장에 박혀 잘 안 지워질 수 있습니다.",
    good: "꽃가루 없으면 청결이 오래 갑니다.",
  },
] as const;

export function OnboardingGuide() {
  return (
    <section className="onboarding-guide">
      <section className="onboarding-header">
        <h2 className="onboarding-title">3일 청결도 비교</h2>
        <p className="onboarding-lead">
          앞으로 3일 동안 비·미세먼지·꽃가루가 차에 닿는지를 보고, 세차 후에도 깨끗할지
          판단합니다.
        </p>
      </section>

      <ul className="onboarding-compare-list">
        {COMPARE_ITEMS.map((item) => (
          <li key={item.label} className="onboarding-compare-item">
            <p className="onboarding-compare-label">{item.label}</p>
            <div className="onboarding-compare-rows">
              <p>
                <span className="onboarding-compare-tag onboarding-compare-tag--bad">있으면</span>
                {item.bad}
              </p>
              <p>
                <span className="onboarding-compare-tag onboarding-compare-tag--good">없으면</span>
                {item.good}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="onboarding-summary">
        세 가지가 모두 적을수록 세차 타이밍이 좋습니다. 버튼을 누르면 내 위치 기준으로
        비교합니다.
      </p>

      <p className="onboarding-disclaimer">
        예보는 확률·예측이며 실제와 다를 수 있습니다. 차량 상태·주행·주차 환경은 사람마다 달라
        참고용입니다.
      </p>
    </section>
  );
}
