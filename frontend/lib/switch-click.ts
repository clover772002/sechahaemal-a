let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioContext = new AudioCtx();
  }

  return audioContext;
}

export function playSwitchClick(): void {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const duration = 0.045;
  const frameCount = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frameCount, 2.8);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.42, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration);

  const thump = ctx.createOscillator();
  thump.type = "square";
  thump.frequency.setValueAtTime(200, now);
  thump.frequency.exponentialRampToValueAtTime(90, now + 0.03);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.1, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  thump.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  thump.start(now);
  thump.stop(now + 0.035);
}
