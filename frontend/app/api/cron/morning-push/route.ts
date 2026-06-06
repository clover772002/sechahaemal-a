import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/push/send-morning`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(body, { status: res.status });
    }

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "백엔드 호출 실패" }, { status: 502 });
  }
}
