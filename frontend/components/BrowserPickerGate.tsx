"use client";

import type { ExternalBrowser } from "@/lib/in-app-browser";

type Props = {
  onSelect: (browser: ExternalBrowser) => void;
};

function SafariIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#0ea5e9" />
      <circle cx="24" cy="24" r="18" fill="#fff" />
      <path
        d="M24 8a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm0 4.5a11.5 11.5 0 1 1 0 23 11.5 11.5 0 0 1 0-23Z"
        fill="#ef4444"
      />
      <path d="M24 12 30 30 18 24Z" fill="#ef4444" />
      <path d="m24 12 6 18-12-6Z" fill="#0f172a" opacity="0.12" />
    </svg>
  );
}

function ChromeIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
      <path
        d="M24 10c7.7 0 14.2 5.2 16.1 12.3H30.8C29.2 16.8 26.8 15 24 15c-4.2 0-7.7 2.7-9 6.4L9.8 14.2C12.8 11.2 18 10 24 10Z"
        fill="#ea4335"
      />
      <path
        d="M15 32.3c-2.4-3.7-2.4-8.5 0-12.2l5.2 4.5c-.6 1.8-.4 3.8.6 5.5l-5.8 2.2Z"
        fill="#34a853"
      />
      <path
        d="M24 38c-3.5 0-6.6-1.5-8.8-3.9l5.8-2.2c1 .7 2.2 1.1 3.5 1.1 1.4 0 2.6-.4 3.6-1.1l5.2 4.5C33.5 36.2 29 38 24 38Z"
        fill="#fbbc04"
      />
      <path
        d="M40.1 22.3c.3 1.1.4 2.3.4 3.5 0 1.4-.2 2.8-.6 4.1H30.8c.8-1.6 1.2-3.4 1.2-5.3 0-.6-.1-1.2-.2-1.8h9.3Z"
        fill="#4285f4"
      />
      <circle cx="24" cy="24" r="7" fill="#fff" />
      <circle cx="24" cy="24" r="5.5" fill="#4285f4" />
      <circle cx="24" cy="24" r="3.5" fill="#fff" />
    </svg>
  );
}

export function BrowserPickerGate({ onSelect }: Props) {
  return (
    <section className="browser-picker">
      <p className="browser-picker-label">Safari 또는 Chrome을 선택해 주세요</p>
      <div className="browser-picker-grid">
        <button type="button" className="browser-picker-btn" onClick={() => onSelect("safari")}>
          <span className="browser-picker-icon">
            <SafariIcon />
          </span>
          <span className="browser-picker-name">Safari</span>
        </button>
        <button type="button" className="browser-picker-btn" onClick={() => onSelect("chrome")}>
          <span className="browser-picker-icon">
            <ChromeIcon />
          </span>
          <span className="browser-picker-name">Chrome</span>
        </button>
      </div>
    </section>
  );
}
