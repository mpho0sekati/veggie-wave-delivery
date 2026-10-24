import { useEffect, useRef } from "react";

/**
 * Alerts a trader to a new incoming wave with a whistle sound + device vibration.
 * A street runner pushing a cart won't be staring at the screen — this makes
 * sure the 2-minute wave timer doesn't expire unnoticed.
 *
 * Fires only when the wave count RISES (0 -> 1, 1 -> 2), never on first mount
 * or when waves clear, so it doesn't nag.
 */
export function useWaveAlert(waveCount: number, enabled: boolean) {
  const prevCount = useRef(waveCount);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = waveCount;

    if (!enabled) return;
    if (waveCount <= prev) return; // only alert when a NEW wave arrives

    // 1. Vibrate — works through a pocket, on a handlebar mount, in a noisy market
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    } catch {
      /* vibration unsupported */
    }

    // 2. Whistle — a short two-tone rising chirp built with the Web Audio API,
    // so there's no audio file to ship and it works offline.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      // Browsers suspend audio until a user gesture; resume if we can.
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      const blast = (startAt: number, from: number, to: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(from, startAt);
        osc.frequency.exponentialRampToValueAtTime(to, startAt + 0.18);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + 0.25);
      };
      blast(now, 880, 1320); // first chirp
      blast(now + 0.28, 1046, 1568); // second, higher chirp
    } catch {
      /* audio unsupported */
    }
  }, [waveCount, enabled]);
}
