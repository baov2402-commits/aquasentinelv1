let audioCtx: AudioContext | null = null;
let lastBeepTime = 0;

export function playAlertBeep(isCritical: boolean, enabled: boolean): void {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastBeepTime < (isCritical ? 900 : 1800)) return;
  lastBeepTime = now;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = isCritical ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isCritical ? 880 : 620, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.17);
  } catch {
    // Audio playback blocked by browser autoplay policy until user gesture
  }
}
