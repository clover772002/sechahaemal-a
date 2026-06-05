"use client";

import { useState } from "react";
import { copyCurrentPageUrl, openInExternalBrowser, type InAppBrowserInfo } from "@/lib/in-app-browser";

type Props = {
  browser: InAppBrowserInfo;
};

export function InAppBrowserNotice({ browser }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  if (!browser.isInApp) return null;

  const appName = browser.appLabel ?? "앱 내 브라우저";

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  };

  const handleOpenExternal = () => {
    openInExternalBrowser();
    showNotice("Chrome 또는 Safari에서 페이지를 열어 주세요.");
  };

  const handleCopyLink = async () => {
    const copied = await copyCurrentPageUrl();
    showNotice(
      copied
        ? "링크를 복사했어요. Chrome·Safari 주소창에 붙여넣기 하세요."
        : "링크 복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.",
    );
  };

  return (
    <div className="in-app-browser-notice" role="alert">
      <p className="in-app-browser-notice-title">
        {appName}에서는 Google 로그인이 차단됩니다
      </p>
      <p className="in-app-browser-notice-text">
        Google 보안 정책상 {appName} 안에서는 로그인할 수 없어요. Chrome·Safari 같은
        외부 브라우저에서 열어 주세요.
      </p>
      {browser.appLabel === "카카오톡" && (
        <p className="in-app-browser-notice-hint">
          카카오톡 우측 상단 <strong>⋮</strong> 또는 <strong>···</strong> 메뉴 →{" "}
          <strong>Safari·Chrome에서 열기</strong>
        </p>
      )}
      <div className="in-app-browser-notice-actions">
        <button type="button" className="in-app-browser-btn in-app-browser-btn--primary" onClick={handleOpenExternal}>
          외부 브라우저에서 열기
        </button>
        <button type="button" className="in-app-browser-btn" onClick={handleCopyLink}>
          링크 복사
        </button>
      </div>
      {notice && <p className="in-app-browser-notice-feedback">{notice}</p>}
    </div>
  );
}
