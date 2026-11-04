/**
 * Animation de lancement PilotPro : phases réglables (secondes depuis l'ouverture).
 * Modifier ces valeurs suffit pour ajuster le rythme ; CSS et son en dépendent.
 */
export const LAUNCH_PHASES = {
  seed: { start: 0.1, dur: 0.6 },
  stem: { start: 0.5, dur: 0.9 },
  leaf: { start: 1.2, dur: 0.7, stagger: 0.3 },
  ring: { start: 2.2, dur: 1.6 },
  name: { start: 3.4, dur: 0.8 },
  motto: { start: 3.8, dur: 0.7 },
  /** Battements : deux cycles « lub-dub » = quatre pulsations. */
  heart: { start: 4.7, beats: [0, 0.28, 0.95, 1.23] },
  /** Fin de la séquence, puis fondu vers l'application. */
  end: 6.3,
} as const;

/** Instant absolu (s) de chaque pulsation. */
export function heartbeatTimes(): number[] {
  return LAUNCH_PHASES.heart.beats.map((b) => LAUNCH_PHASES.heart.start + b);
}

type CapLike = {
  Plugins?: { Haptics?: { impact?: (o: { style: string }) => Promise<unknown> } };
};

/**
 * Battements de cœur : son synthétisé (aucun fichier) si le navigateur l'autorise,
 * vibration légère dans l'appli mobile. Toute erreur ou blocage = silence, sans gêne.
 */
export function playHeartbeat(): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const timers: number[] = [];
  const nowS = performance.now() / 1000;
  let ctx: AudioContext | null = null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx = new AC();
      void ctx.resume().catch(() => {});
    }
  } catch {
    ctx = null;
  }
  const cap = (window as unknown as { Capacitor?: CapLike }).Capacitor;
  heartbeatTimes().forEach((t, i) => {
    const delay = Math.max(0, (t - nowS) * 1000);
    timers.push(
      window.setTimeout(() => {
        try {
          void cap?.Plugins?.Haptics?.impact?.({ style: i % 2 ? "LIGHT" : "MEDIUM" });
        } catch {
          /* pas de vibration disponible */
        }
        if (!ctx || ctx.state !== "running") return; // autoplay bloqué : silence
        const at = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(i % 2 ? 55 : 65, at);
        osc.frequency.exponentialRampToValueAtTime(38, at + 0.18);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(i % 2 ? 0.35 : 0.5, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.25);
      }, delay),
    );
  });
  timers.push(
    window.setTimeout(() => void ctx?.close().catch(() => {}), (LAUNCH_PHASES.end + 1) * 1000),
  );
  return () => timers.forEach((id) => window.clearTimeout(id));
}
