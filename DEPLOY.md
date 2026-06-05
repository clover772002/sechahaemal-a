# 세차해말아 배포 가이드

**프론트**: Vercel (Next.js)  
**백엔드**: Render (FastAPI + Docker)

예상 비용: 무료 티어로 시작 가능 (Render 무료는 슬립 모드 있음)

---

## 0. 사전 준비

- [GitHub](https://github.com) 계정
- [Vercel](https://vercel.com) 계정 (GitHub 연동)
- [Render](https://render.com) 계정 (GitHub 연동)
- 공공데이터 API 키 (Encoding)
- Google OAuth 클라이언트 ID/Secret

---

## 1. GitHub에 코드 올리기

> 프로젝트 폴더명이 한글이면 Git/배포 도구에서 문제가 날 수 있습니다.  
> 영문 경로 `sechahaemal-a` 정션을 사용하거나 폴더명을 영문으로 바꾸는 것을 권장합니다.

```powershell
cd c:\Users\forsm\sechahaemal-a
git init
git add .
git commit -m "세차해말아 MVP 배포 준비"
gh repo create sechahaemal-a --public --source=. --push
```

`.env`, `.env.local` 파일은 **절대 커밋하지 마세요** (이미 .gitignore에 포함됨).

---

## 2. 백엔드 배포 (Render)

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**
2. GitHub 저장소 `sechahaemal-a` 연결
3. 루트의 `render.yaml` 자동 인식 → **Apply**

### 환경 변수 (Render 대시보드)

| Key | Value |
|-----|-------|
| `PUBLIC_DATA_API_KEY` | 공공데이터 Encoding 키 |
| `CORS_ORIGINS` | `https://YOUR-APP.vercel.app` (프론트 배포 후 URL) |

배포 완료 후 API URL 확인:
```
https://sechahaemal-a-api.onrender.com
```

헬스체크:
```
https://sechahaemal-a-api.onrender.com/health
```

---

## 3. 프론트 배포 (Vercel)

1. [Vercel Dashboard](https://vercel.com/new) → GitHub 저장소 Import
2. **Root Directory**: `frontend` 로 설정
3. Framework: Next.js (자동 감지)

### 환경 변수 (Vercel)

| Key | Value |
|-----|-------|
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `NEXTAUTH_SECRET` | 랜덤 32자+ 문자열 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 시크릿 |
| `NEXT_PUBLIC_API_URL` | `https://sechahaemal-a-api.onrender.com` |

4. **Deploy** 클릭

---

## 4. Google OAuth 프로덕션 설정

[Google Cloud Console](https://console.cloud.google.com/) → 사용자 인증 정보 → OAuth 클라이언트

**승인된 JavaScript 원본** 추가:
```
https://YOUR-APP.vercel.app
```

**승인된 리디렉션 URI** 추가:
```
https://YOUR-APP.vercel.app/api/auth/callback/google
```

---

## 5. 배포 후 연동 확인

1. Vercel URL 접속 → Google 로그인
2. **위치 허용** (HTTPS에서만 GPS 동작)
3. 3일 강수확률 · 미세먼지 · 신호등 판정 표시 확인

문제 시:
- Vercel Functions 로그 (NextAuth 오류)
- Render Logs (API 502/401)
- `CORS_ORIGINS`에 Vercel URL 정확히 입력했는지 확인

---

## 6. 로컬 vs 프로덕션 환경변수 요약

| 변수 | 로컬 | 프로덕션 |
|------|------|----------|
| `NEXTAUTH_URL` | `http://localhost:3001` | `https://xxx.vercel.app` |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | `https://xxx.onrender.com` |
| `CORS_ORIGINS` | localhost 포함 (기본값) | Vercel URL만 |

---

## 7. (선택) Vercel CLI로 배포

```powershell
cd c:\Users\forsm\sechahaemal-a\frontend
npx vercel login
npx vercel --prod
```

환경 변수는 Vercel 대시보드에서 설정하거나 `vercel env add` 사용.
