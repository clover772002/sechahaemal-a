"use client";

import type { ExternalBrowser } from "@/lib/in-app-browser";

type Props = {
  onSelect: (browser: ExternalBrowser) => void;
};

export function BrowserPickerGate({ onSelect }: Props) {
  return (
    <div
      className="browser-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="browser-picker-title"
    >
      <div className="browser-picker-modal">
        <p id="browser-picker-title" className="browser-picker-label">
          브라우저를 선택해 주세요
        </p>
        <div className="browser-picker-grid">
          <button type="button" className="browser-picker-btn" onClick={() => onSelect("safari")}>
            <span className="browser-picker-icon">
              <img src="/icons/safari.svg" alt="Safari" width={72} height={72} />
            </span>
            <span className="browser-picker-name">Safari</span>
          </button>
          <button type="button" className="browser-picker-btn" onClick={() => onSelect("chrome")}>
            <span className="browser-picker-icon">
              <img src="/icons/chrome.svg" alt="Chrome" width={72} height={72} />
            </span>
            <span className="browser-picker-name">Chrome</span>
          </button>
        </div>
      </div>
    </div>
  );
}
