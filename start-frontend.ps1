# 한글 폴더명에서 Next.js 오류가 나므로 영문 경로로 실행합니다.
Set-Location "$PSScriptRoot\..\sechahaemal-a\frontend"
if (-not (Test-Path .)) {
    Set-Location "c:\Users\forsm\sechahaemal-a\frontend"
}
npm run dev -- -p 3001
