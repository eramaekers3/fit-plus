// The rest timer. One at a time, kept in memory and in localStorage, so it survives the app going to
// the background (it counts from a timestamp, not ticks). When it runs out you get a buzz and a toast.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { haptic } from './haptics.js';
import { toast } from './toast.js';

const KEY = 'fitplus.rest';
let timer = read(); // { ends: ms, total: s, label, next } | null
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function read() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY));
    return t && t.ends > Date.now() - 5000 ? t : null;
  } catch {
    return null;
  }
}
function save() {
  try {
    if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

let alarm = null;
function arm() {
  clearTimeout(alarm);
  if (!timer) return;
  alarm = setTimeout(() => {
    haptic('big');
    toast(timer && timer.next ? `Rest’s up · ${timer.next}` : 'Rest’s up');
    timer = null;
    save();
    emit();
  }, Math.max(0, timer.ends - Date.now()));
}
arm();

/** Starts (or restarts) the rest timer. next: what's up after it, shown on the bar. */
export function startRest(seconds, label = 'Rest', next = '') {
  timer = { ends: Date.now() + seconds * 1000, total: seconds, label, next };
  save();
  arm();
  emit();
}
export function addRest(seconds) {
  if (!timer) return;
  timer = { ...timer, ends: timer.ends + seconds * 1000, total: timer.total + seconds };
  save();
  arm();
  emit();
}
export function stopRest() {
  timer = null;
  clearTimeout(alarm);
  save();
  emit();
}

export function useRest() {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => timer
  );
  const [, tick] = useState(0);
  useEffect(() => {
    if (!t) return;
    const i = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(i);
  }, [t]);
  if (!t) return null;
  const left = Math.max(0, Math.ceil((t.ends - Date.now()) / 1000));
  return { ...t, left, p: 1 - left / t.total };
}

export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
