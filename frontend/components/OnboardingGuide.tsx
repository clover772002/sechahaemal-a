export function OnboardingGuide() {
  return (
    <section className="card onboarding-guide" aria-labelledby="onboarding-title">
      <header className="onboarding-header">
        <h2 id="onboarding-title" className="onboarding-title">
          오늘 세차, 해도 될까?
        </h2>
        <p className="onboarding-sub">
          내 위치 기준 <strong>3일 강수확률·초미세먼지·꽃가루</strong> 예보를 보고,{" "}
          <strong>지금 세차할지 미룰지</strong> 빠르게 판단해 드립니다.
        </p>
      </header>

      <section className="onboarding-section">
        <h3 className="onboarding-section-title">
          세차가 <span>해야 할</span> 때
        </h3>
        <ul className="onboarding-list">
          <li>
            먼지가 이미 두껍게 쌓인 상태 — 이 상태에서 비만 오면{" "}
            <strong>먼지가 비에 눌러 붙어</strong> 물때·검은 줄띠가 생깁니다.
          </li>
          <li>
            <strong>미세먼지·꽃가루</strong>가 차체에 달라붙기 시작했을 때 — 맑아 보여도 닦을수록{" "}
            <strong>지저분해지는</strong> 경우가 많습니다.
          </li>
        </ul>
      </section>

      <section className="onboarding-section">
        <h3 className="onboarding-section-title">
          세차 <span>미루는</span> 게 나은 때
        </h3>
        <p className="onboarding-lead">
          앞으로 3일 동안 차에 엉겨붙을 이물질(비·먼지·꽃가루)이 없어야, 세차 효과가 오래 갑니다.
        </p>
        <ul className="onboarding-list">
          <li>
            <strong>3일 안 강수확률이 높을 때</strong> — 세차 직후 비를 맞으면 먼지·미세먼지·꽃가루가
            비에 <strong>눌러 붙고</strong>, 물때·얼룩이 생겨 오히려 더 지저분해집니다.
          </li>
          <li>
            <strong>미세먼지·황사</strong>가 나쁠 때 — 닦은 직후 공기 중 입자가 다시 달라붙어 청결
            유지 시간이 짧아집니다.
          </li>
          <li>
            <strong>꽃가루 위험지수</strong>가 높을 때 — 꽃가루가 수분·먼지와 <strong>엉겨</strong>{" "}
            외장에 박히면 일반 세차만으로 잘 안 지워집니다.
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
