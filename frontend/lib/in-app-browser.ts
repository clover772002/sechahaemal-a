const IN_APP_BROWSERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /KAKAOTALK/i, label: "카카오톡" },
  { pattern: /Instagram/i, label: "인스타그램" },
  { pattern: /FBAN|FBAV/i, label: "페이스북" },
  { pattern: /Line\//i, label: "라인" },
  { pattern: /NAVER\(inapp;/i, label: "네이버" },
  { pattern: /DaumApps/i, label: "다음" },
];

export type InAppBrowserInfo = {
  isInApp: boolean;
  appLabel: string | null;
};

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === "undefined") {
    return { isInApp: false, appLabel: null };
  }

  const ua = navigator.userAgent;
  for (const { pattern, label } of IN_APP_BROWSERS) {
    if (pattern.test(ua)) {
      return { isInApp: true, appLabel: label };
    }
  }

  if (/Android/.test(ua) && /;\s*wv\)/.test(ua)) {
    return { isInApp: true, appLabel: null };
  }

  return { isInApp: false, appLabel: null };
}

export async function copyCurrentPageUrl(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}

export function openInExternalBrowser(url?: string): void {
  if (typeof window === "undefined") return;

  const targetUrl = url ?? window.location.href;
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    const stripped = targetUrl.replace(/^https?:\/\//, "");
    window.location.href = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(targetUrl)};end`;
    return;
  }

  if (isIOS) {
    window.location.href = `googlechrome://${targetUrl.replace(/^https:\/\//, "")}`;
    return;
  }

  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
