"use client";

import type { ExternalBrowser } from "@/lib/in-app-browser";

type Props = {
  onSelect: (browser: ExternalBrowser) => void;
};

export function BrowserPickerGate({ onSelect }: Props) {
  return (
    <section className="browser-picker">
      <p className="browser-picker-label">Safari 또는 Chrome을 선택해 주세요</p>
      <div className="browser-picker-grid">
        <button type="button" className="browser-picker-btn" onClick={() => onSelect("safari")}>
          <span className="browser-picker-icon">
            <img src="/icons/safari.svg" alt="Safari" width={72} height={72} />
          </span>
          <span className="browser-picker-name">Safari</span>
        </button>
        <button type="button" className="browser-picker-btn" onClick={() => onSelect("chrome")}>
          <span className="browser-picker-icon">
            <Image src="/icons/chrome.svg" alt="Chrome" width={72} height={72} priority />
          </span>
          <span className="browser-picker-name">Chrome</span>
        </button>
      </div>
    </section>
  );
}
