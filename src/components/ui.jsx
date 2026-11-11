import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sheetOut, toastOut } from '../lib/motion.js';
import { logoSVG } from '../lib/logo.js';
import { createPortal } from 'react-dom';
import { useDragDismiss } from '../lib/dragDismiss.js';
import { useToast, dismissToast } from '../lib/toast.js';

export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/* ---------- Logo ---------- */
export function LogoMark({ color, size = 30, className = 'logo-mark' }) {
  const html = useMemo(() => logoSVG(color, { id: `lm${String(color).replace(/\W/g, '')}` }), [color]);
  return <span className={className} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------- Icons ---------- */
const paths = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  train: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  fuel: <><path d="M12 3.5c3 3.2 5.5 6.3 5.5 9.6a5.5 5.5 0 0 1-11 0c0-3.3 2.5-6.4 5.5-9.6Z" /><path d="M10 14.5a2 2 0 0 0 2 2" /></>,
  progress: <><path d="M4 18.5 9.5 13l3.5 3.5L20 9.5" /><path d="M15 9.5h5v5" /></>,
  plan: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  left: <path d="m14.5 6-6 6 6 6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  check: <path d="m5.5 12.5 4 4 9-9.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  grip: <><circle cx="9" cy="6.5" r="1.3" /><circle cx="15" cy="6.5" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="17.5" r="1.3" /><circle cx="15" cy="17.5" r="1.3" /></>,
  down: <path d="m6 9.5 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></>,
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" />,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 9.5a5 5 0 0 1 7 0L12 12" /></>,
  heart: <path d="M12 19.5s-7-4.3-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.1c0 5.1-7 9.4-7 9.4Z" />,
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5v17M6 6c2.5 2.3 2.5 9.7 0 12M18 6c-2.5 2.3-2.5 9.7 0 12" /></>,
  bolt: <path d="M13 3.5 5.5 13.5H11l-1 7 7.5-10H12l1-7Z" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  swap: <><path d="M7 7h11l-3-3M17 17H6l3 3" /></>,
  skip: <><path d="m6 6 7 6-7 6V6ZM17 6v12" /></>,
  jump: <><path d="M12 4v10M8 8l4-4 4 4" /><path d="M5 20h14" /></>,
  note: <><path d="M5.5 4.5h9l4 4v11h-13v-15Z" /><path d="M14.5 4.5v4h4M8.5 12.5h7M8.5 16h5" /></>,
};
export function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/* ---------- Bottom sheet ---------- */

/**
 * The part of the screen you can actually see. On iPhone the keyboard slides over the page instead
 * of shrinking it, so sheets size themselves to this to stay above the keyboard.
 */
function useVisibleArea() {
  const read = () => {
    const vv = window.visualViewport;
    if (!vv) return null;
    return { top: vv.offsetTop, height: vv.height, keyboard: window.innerHeight - vv.height > 120 };
  };
  const [area, setArea] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Only follow real size changes (the keyboard opening or closing), not scrolling, and ignore
    // sub-pixel jitter: reacting to every scroll fights iPhone's own scroll-to-the-text-box and
    // makes the sheet jump back and forth.
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setArea((prev) => {
          const next = read();
          if (prev && next && Math.abs(prev.height - next.height) < 2 && Math.abs(prev.top - next.top) < 2) return prev;
          return next;
        })
      );
    };
    vv.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
    };
  }, []);
  return area;
}

export function Sheet({ title, onClose, children, top = false }) {
  const area = useVisibleArea();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  useDragDismiss(sheetRef, () => closeRef.current(), { scrim: scrimRef });
  // However it closes, the sheet animates out (see motion.js).
  useLayoutEffect(() => {
    const node = scrimRef.current;
    return () => sheetOut(node);
  }, []);
  // Runs once per sheet. (onClose is often a fresh function each render; re-running this on every
  // keystroke would unpin and re-pin the page, which makes it jump.)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    // Pin the page in place while a sheet is open, so iPhone can't scroll it underneath.
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow };
    Object.assign(b, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' });
    return () => {
      window.removeEventListener('keydown', onKey);
      Object.assign(b, prev);
      window.scrollTo(0, y);
    };
  }, []);
  return createPortal(
    <div
      ref={scrimRef}
      className={`scrim${top ? ' top' : ''}${area && area.keyboard ? ' kb' : ''}`}
      style={area ? { top: area.top, height: area.height, bottom: 'auto', '--vh': `${area.height}px` } : undefined}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheetRef}>
        <div className="grab-bar" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>×</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Toast ---------- */
export function Toaster() {
  const t = useToast();
  if (!t) return null;
  return <Toast t={t} key={t.key} />;
}

function Toast({ t }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    return () => toastOut(node);
  }, []);
  return (
    <div className={`toast${t.action ? ' has-action' : ''}`} ref={ref} role="status">
      {t.text}
      {t.action && (
        <button
          className="toast-action"
          onClick={() => {
            t.action.run();
            dismissToast();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

/* ---------- Numbers that count up when they first appear or change ---------- */
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CountUp({ value, format = (v) => String(Math.round(v)), ms = 700 }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const v = a + (value - a) * e;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return <span className="count">{format(shown)}</span>;
}

/* ---------- Progress ring ---------- */
export function Ring({ p, size = 64, stroke = 7, color = 'var(--sun)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, p || 0));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeWidth={stroke}
          style={{ stroke: color, strokeDasharray: c, '--off': c * (1 - v), '--full': c }}
        />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  );
}
