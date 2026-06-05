# 세차해말아 배포 가이드

**프론트**: Vercel (Next.js)  
**백엔드**: Railway (FastAPI + Docker)

GitHub 저장소: https://github.com/clover772002/sechahaemal-a

---

## 0. 사전 준비

- [Vercel](https://vercel.com) 계정 (GitHub 연동)
- [Railway](https://railway.com) 계정 (GitHub 연동, 구독 중)
- 공공데이터 API 키 (Encoding)
- Google OAuth 클라이언트 ID/Secret

---

## 1. 백엔드 배포 (Railway)

1. [Railway Dashboard](https://railway.com/dashboard) → **New Project**
2. **Deploy from GitHub repo** → `clover772002/sechahaemal-a` 선택
3. 서비스 생성 후 **Settings**:
   - **Root Directory**: `backend`
   - **Builder**: Dockerfile (자동 감지, `backend/Dockerfile`)
4. **Variables** 탭에서 환경 변수 추가:

| Key | Value |
|-----|-------|
| `PUBLIC_DATA_API_KEY` | 공공데이터 Encoding 키 |
| `CORS_ORIGINS` | `https://YOUR-APP.vercel.app` (프론트 배포 후 입력) |

5. **Settings** → **Networking** → **Generate Domain** 클릭

배포 확인:
```
https://YOUR-SERVICE.up.railway.app/health
```
→ `{"status":"ok"}`

---

## 2. 프론트 배포 (Vercel)

1. [Vercel Dashboard](https://vercel.com/new) → `sechahaemal-a` Import
2. **Root Directory**: `frontend`
3. Framework: Next.js (자동 감지)

### 환경 변수 (Vercel)

| Key | Value |
|-----|-------|
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `NEXTAUTH_SECRET` | 랜덤 32자+ 문자열 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 시크릿 |
| `NEXT_PUBLIC_API_URL` | `https://YOUR-SERVICE.up.railway.app` |

4. **Deploy** 클릭

---

## 3. Google OAuth 프로덕션 설정

[Google Cloud Console](https://console.cloud.google.com/) → 사용자 인증 정보

**승인된 JavaScript 원본**:
```
https://YOUR-APP.vercel.app
```

**승인된 리디렉션 URI**:
```
https://YOUR-APP.vercel.app/api/auth/callback/google
```

---

## 4. Railway CORS 업데이트

Vercel URL이 확정되면 Railway **Variables**에서:

```
CORS_ORIGINS=https://YOUR-APP.vercel.app
```

저장 시 Railway가 자동 재배포합니다.

---

## 5. 배포 후 확인

1. Vercel URL → Google 로그인
2. 위치 허용 (HTTPS 필수)
3. 3일 강수확률 · 미세먼지 · 신호등 판정 표시

문제 시:
- **Vercel** → Deployments → Functions 로그 (NextAuth)
- **Railway** → Deployments → View Logs (API 오류)
- `NEXT_PUBLIC_API_URL`이 Railway 도메인과 일치하는지 확인
- `CORS_ORIGINS`에 Vercel URL이 정확한지 확인

---

## 6. 환경변수 요약

| 변수 | 로컬 | 프로덕션 |
|------|------|----------|
| `NEXTAUTH_URL` | `http://localhost:3001` | Vercel URL |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Railway URL |
| `CORS_ORIGINS` | localhost 포함 (기본값) | Vercel URL |
| `PUBLIC_DATA_API_KEY` | `backend/.env` | Railway Variables |

---

## 7. (선택) Railway CLI

```powershell
npm i -g @railway/cli
railway login
cd backend
railway link
railway up
```

환경 변수는 `railway variables set KEY=value` 또는 대시보드에서 설정.
