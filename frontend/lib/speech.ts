import type { Decision } from "@/lib/types";

const VOICES_TIMEOUT_MS = 2500;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 버튼 클릭 직후(동기) 호출해 TTS 엔진을 깨워 둡니다. */
export function primeSpeechSynthesis(): void {
  if (!isSpeechSupported()) return;

  const synth = window.speechSynthesis;
  synth.getVoices();

  try {
    const ctx = new AudioContext();
    void ctx.resume().finally(() => {
      void ctx.close();
    });
  } catch {
    // ignore
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
  return (
    koreanVoices.find((voice) => voice.lang === "ko-KR") ??
    koreanVoices[0] ??
    voices.find((voice) => voice.default) ??
    voices[0]
  );
}

export function buildConclusionSpeech(decision: Decision): string {
  return `종합 ${decision.score}점. ${decision.signal_label}.`;
}

function runSpeak(text: string, voices: SpeechSynthesisVoice[]): Promise<boolean> {
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

    const voice = pickKoreanVoice(voices);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      started = true;
    };
    utterance.onend = () => done(true);
    utterance.onerror = (event) => {
      if (event.error === "canceled") return;
      done(started);
    };

    synth.cancel();
    window.setTimeout(() => {
      synth.speak(utterance);

      if (isIOS()) {
        window.setTimeout(() => {
          synth.pause();
          synth.resume();
        }, 120);
      }

      window.setTimeout(() => {
        if (!started && !synth.speaking && !synth.pending) {
          synth.speak(utterance);
        }
      }, 300);

      window.setTimeout(() => {
        if (started || synth.speaking || synth.pending) {
          if (!settled) done(true);
          return;
        }
        done(false);
      }, 1500);
    }, 100);
  });
}

export async function speakConclusion(decision: Decision): Promise<boolean> {
  if (!isSpeechSupported()) return false;

  const voices = await waitForVoices();
  const text = buildConclusionSpeech(decision);
  const firstTry = await runSpeak(text, voices);
  if (firstTry) return true;
  return runSpeak(text, voices);
}

/** iOS는 비동기 분석 뒤 자동 재생이 막히는 경우가 많아 버튼 탭을 유도합니다. */
export function shouldAutoSpeak(): boolean {
  return isSpeechSupported() && !isIOS();
}
