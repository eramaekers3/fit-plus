// Celebrations: a ring, a burst of dots and little plus signs (like the logo), and a number that
// pops up and floats away. The same burst lifestyle+ uses.

function ensureLayer() {
  let layer = document.getElementById('cheer-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'cheer-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A small spark burst and a rising "+10 XP" at an element (or {x, y}).
 *   text   the main line, e.g. "+10 XP"
 *   sub    a second line, e.g. "×3 combo · 45 today"
 *   color  spark color (defaults to the accent)
 */
export function cheer(at, { text, sub, color, sparks = true } = {}) {
  if (typeof document === 'undefined' || !at) return;
  let x;
  let y;
  if (at instanceof Element) {
    const r = at.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else ({ x, y } = at);
  const layer = ensureLayer();
  const c = color || getComputedStyle(document.documentElement).getPropertyValue('--sun').trim() || '#ffcf5c';
  const still = reduced();

  if (!still && sparks) {
    // Ring that opens out from the check.
    const ring = document.createElement('i');
    ring.className = 'cheer-ring';
    ring.style.cssText = `left:${x}px;top:${y}px;border-color:${c}`;
    layer.appendChild(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(2.1)', opacity: 0 }], {
      duration: 520,
      easing: 'cubic-bezier(.22,1,.36,1)',
    }).onfinish = () => ring.remove();

    // Sparks.
    const n = 9;
    for (let i = 0; i < n; i++) {
      // Dots, plus a few little plus signs, like the logo.
      const s = document.createElement('i');
      const plusShape = i % 3 === 1;
      s.className = plusShape ? 'cheer-spark plus' : 'cheer-spark';
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = 24 + Math.random() * 20;
      const w = plusShape ? 8 + Math.random() * 3 : 3 + Math.random() * 3;
      const spin = plusShape ? (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 90) : 0;
      s.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${w}px;background:${i % 3 === 2 ? 'var(--ink)' : c}`;
      layer.appendChild(s);
      s.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.7}px), calc(-50% + ${Math.sin(a) * d * 0.7}px)) scale(1.1) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 8}px)) scale(.3) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 560 + Math.random() * 200, easing: 'cubic-bezier(.22,1,.36,1)' }
      ).onfinish = () => s.remove();
    }
  }

  if (text) {
    const pop = document.createElement('div');
    pop.className = 'cheer-pop';
    pop.innerHTML = `<b></b>${sub ? '<span></span>' : ''}`;
    pop.querySelector('b').textContent = text;
    if (sub) pop.querySelector('span').textContent = sub;
    const left = Math.max(60, Math.min(window.innerWidth - 60, x));
    pop.style.cssText = `left:${left}px;top:${y - 14}px`;
    layer.appendChild(pop);
    pop.animate(
      still
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
        : [
            { transform: 'translate(-50%,-30%) scale(.6) rotate(-6deg)', opacity: 0 },
            { transform: 'translate(-50%,-105%) scale(1.08) rotate(2deg)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%,-100%) scale(1) rotate(0deg)', opacity: 1, offset: 0.32 },
            { transform: 'translate(-50%,-115%) scale(1)', opacity: 1, offset: 0.7 },
            { transform: 'translate(-50%,-150%) scale(.96)', opacity: 0 },
          ],
      { duration: 1250, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }
    ).onfinish = () => pop.remove();
  }
}
