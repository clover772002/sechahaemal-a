import type { Decision } from "@/lib/types";

export function buildConclusionSpeech(decision: Decision): string {
  return `종합 ${decision.score}점. ${decision.signal_label}.`;
}

export function speakConclusion(decision: Decision): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(buildConclusionSpeech(decision));
  utterance.lang = "ko-KR";
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}
