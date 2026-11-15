// A short three-note chime for when rest is up, made with Web Audio (no sound files).
// iPhone only lets a page play sound after a tap, so the audio is unlocked on the first tap.

let ctx = null;

function unlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    // A silent blip finishes the unlock on older iPhones.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch {
    /* no audio here */
  }
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlock();
    window.removeEventListener('touchend', once, true);
    window.removeEventListener('click', once, true);
  };
  window.addEventListener('touchend', once, true);
  window.addEventListener('click', once, true);
  // Coming back to the app can leave the audio suspended again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
      const again = () => {
        unlock();
        window.removeEventListener('touchend', again, true);
      };
      window.addEventListener('touchend', again, true);
    }
  });
}

/** Plays the chime. Quiet if the page hasn't been tapped yet or the phone can't play it. */
export function chime() {
  if (!ctx || ctx.state !== 'running') return;
  try {
    // Plays over music for a moment (ducking it) instead of stopping it.
    if (navigator.audioSession) navigator.audioSession.type = 'transient';
  } catch {
    /* not supported */
  }
  const t0 = ctx.currentTime + 0.02;
  [784, 988, 1319].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = t0 + i * 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.5);
  });
}
