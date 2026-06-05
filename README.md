# 오늘 세차 할까?

Google 로그인 후 **현재 위치**를 기준으로, 지금 세차해도 되는지 알려주는 앱입니다.

## 화면 구성

1. **3일 강수확률** (오늘 · 내일 · 모레)
2. **3일 강수 요약** (평균 / 최대 / 비 예상 일수)
3. **3일 초미세먼지(PM2.5) 예상**
4. **신호등 종합 판정** (초록 / 노랑 / 빨강)
5. **판정 기준** 안내

## 배포

프로덕션 배포: **[DEPLOY.md](./DEPLOY.md)** (Vercel + Railway)

## 사전 준비

### 1. 공공데이터포털 API
- 기상청 단기예보 조회서비스
- 에어코리아 대기오염정보 (실시간 + 예보 + 인근측정소)

`backend/.env`:
```
PUBLIC_DATA_API_KEY=발급받은_Encoding_키
```

### 2. Google OAuth
[Google Cloud Console](https://console.cloud.google.com/)에서 OAuth 클라이언트 ID 생성

승인된 리디렉션 URI:
```
http://localhost:3001/api/auth/callback/google
```

`frontend/.env.local`:
```
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=랜덤_32자_이상_문자열
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## 실행

```powershell
# 백엔드
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# 프론트 (영문 경로 권장)
cd c:\Users\forsm\sechahaemal-a\frontend
npm install
npm run dev -- -p 3001
```

접속: http://localhost:3001

## API

```
GET /api/analyze?lat=36.03&lng=129.36
```

위경도 → 격자좌표 변환 → 기상/대기질 조회 → 세차 판정 반환

## 신호등 기준

| 신호 | 조건 |
|------|------|
| 초록 | 3일 강수확률 낮음 + 초미세먼지 양호 |
| 노랑 | 강수 또는 미세먼지 조건 애매 |
| 빨강 | 비 예상 다수 또는 강수확률·미세먼지 불리 |
