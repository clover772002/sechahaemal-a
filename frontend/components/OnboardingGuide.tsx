export function OnboardingGuide() {
  return (
    <section className="onboarding-guide">
      <section className="onboarding-section">
        <h3 className="onboarding-section-title">
          <span>해야 할</span> 때
        </h3>
        <ul className="onboarding-list">
          <li>
            <strong>먼지가 이미 두껍게 쌓인 상태</strong> — 이 상태에서 비만 오면 먼지가 비에
            눌러 붙어 물때·검은 줄띠가 생깁니다.
          </li>
          <li>
            <strong>미세먼지·꽃가루가 차체에 달라붙기 시작했을 때</strong> — 맑아 보여도
            닦을수록 지저분해지는 경우가 많습니다.
          </li>
        </ul>
      </section>

      <section className="onboarding-section">
        <h3 className="onboarding-section-title">
          <span>미뤄야 할</span> 때
        </h3>
        <ul className="onboarding-list">
          <li>
            <strong>3일 안 강수확률이 높을 때</strong> — 세차 직후 비를 맞으면 먼지·미세먼지·꽃가루가
            비에 눌러 붙고, 물때·얼룩이 생겨 오히려 더 지저분해집니다.
          </li>
          <li>
            <strong>미세먼지·황사가 나쁠 때</strong> — 닦은 직후 공기 중 입자가 다시 달라붙어 청결
            유지 시간이 짧아집니다.
          </li>
          <li>
            <strong>꽃가루 위험지수가 높을 때</strong> — 꽃가루가 수분·먼지와 엉겨 외장에 박히면
            일반 세차만으로 잘 안 지워집니다.
          </li>
        </ul>
      </section>

      <p className="onboarding-disclaimer">
        예보는 확률·예측이며 실제와 다를 수 있습니다. 차량 상태·주행·주차 환경은 사람마다 달라
        참고용입니다.
      </p>
    </section>
  );
}
