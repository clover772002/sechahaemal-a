import type { Decision } from "@/lib/types";

const VOICES_TIMEOUT_MS = 3000;
const KEEP_ALIVE_MS = 3500;

let keepAliveTimer: number | null = null;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Chrome|CriOS/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent);
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function primeSpeechSynthesis(): void {
  if (!isSpeechSupported()) return;

  const synth = window.speechSynthesis;
  synth.getVoices();
  synth.resume();

  try {
    const ctx = new AudioContext();
    void ctx.resume().finally(() => {
      void ctx.close();
    });
  } catch {
    // ignore
  }
}

/** Chrome: 분석 대기 중 TTS 세션이 끊기지 않도록 유지합니다. */
export function startSpeechKeepAlive(): void {
  stopSpeechKeepAlive();
  if (!isSpeechSupported()) return;

  keepAliveTimer = window.setInterval(() => {
    const synth = window.speechSynthesis;
    synth.resume();
    if (!synth.speaking && !synth.pending) {
      const utterance = new SpeechSynthesisUtterance("\u200b");
      utterance.volume = 0.01;
      utterance.rate = 10;
      utterance.lang = "ko-KR";
      synth.speak(utterance);
    }
  }, KEEP_ALIVE_MS);
}

export function stopSpeechKeepAlive(): void {
  if (keepAliveTimer !== null) {
    window.clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    const finish = () => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    };

    const onChange = () => {
      if (synth.getVoices().length > 0) finish();
    };

    synth.addEventListener("voiceschanged", onChange);
    synth.getVoices();
    window.setTimeout(finish, VOICES_TIMEOUT_MS);
  });
}

function pickKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const koreanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ko"));
  const googleKo = koreanVoices.find((voice) => /google/i.test(voice.name));
  return (
    googleKo ??
    koreanVoices.find((voice) => voice.lang === "ko-KR") ??
    koreanVoices[0] ??
    voices.find((voice) => voice.default) ??
    voices[0]
  );
}

function waitForSpeechIdle(maxMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const synth = window.speechSynthesis;
      if (!synth.speaking && !synth.pending) {
        resolve();
        return;
      }
      if (Date.now() - started > maxMs) {
        synth.cancel();
        window.setTimeout(resolve, 120);
        return;
      }
      window.setTimeout(tick, 150);
    };
    tick();
  });
}

export function buildConclusionSpeech(decision: Decision): string {
  return `종합 ${decision.score}점. ${decision.signal_label}.`;
}

type SpeakOptions = {
  cancelFirst?: boolean;
  useVoice?: boolean;
};

function runSpeak(
  text: string,
  voices: SpeechSynthesisVoice[],
  options: SpeakOptions = {},
): Promise<boolean> {
  const { cancelFirst = true, useVoice = true } = options;

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let started = false;
    let settled = false;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1;
    utterance.volume = 1;
    utterance.pitch = 1;

    if (useVoice) {
      const voice = pickKoreanVoice(voices);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => {
      started = true;
    };
    utterance.onend = () => done(true);
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") return;
      done(started);
    };

    const start = () => {
      synth.resume();
      synth.speak(utterance);

      if (isIOS() || isChrome()) {
        window.setTimeout(() => {
          synth.pause();
          synth.resume();
        }, 120);
      }

      window.setTimeout(() => {
        if (!started && !synth.speaking && !synth.pending) {
          synth.resume();
          synth.speak(utterance);
        }
      }, 350);

      window.setTimeout(() => {
        if (started || synth.speaking || synth.pending) {
          if (!settled) done(true);
          return;
        }
        done(false);
      }, 2000);
    };

    if (cancelFirst && (synth.speaking || synth.pending)) {
      synth.cancel();
      window.setTimeout(start, 150);
    } else {
      window.setTimeout(start, 50);
    }
  });
}

async function speakWithFallback(text: string): Promise<boolean> {
  const voices = await waitForVoices();

  if (await runSpeak(text, voices, { cancelFirst: true, useVoice: true })) return true;
  if (await runSpeak(text, voices, { cancelFirst: true, useVoice: false })) return true;
  return runSpeak(text, voices, { cancelFirst: false, useVoice: false });
}

/** 버튼 클릭 직후(동기) 재생 — Chrome 사용자 제스처 연결용 */
export function speakAnalysisIntro(): void {
  if (!isSpeechSupported()) return;

  const synth = window.speechSynthesis;
  synth.resume();
  synth.getVoices();

  const utterance = new SpeechSynthesisUtterance("예보를 분석합니다. 잠시만 기다려 주세요.");
  utterance.lang = "ko-KR";
  utterance.rate = 1.05;
  utterance.volume = 1;

  const voice = pickKoreanVoice(synth.getVoices());
  if (voice) utterance.voice = voice;

  synth.speak(utterance);
}

export async function speakConclusion(decision: Decision): Promise<boolean> {
  if (!isSpeechSupported()) return false;

  stopSpeechKeepAlive();
  await waitForSpeechIdle();
  return speakWithFallback(buildConclusionSpeech(decision));
}

export function shouldAutoSpeak(): boolean {
  return isSpeechSupported() && !isIOS();
}
