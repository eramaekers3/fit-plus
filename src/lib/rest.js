// The rest timer. One at a time, kept in memory and in localStorage, so it survives the app going to
// the background (it counts from a timestamp, not ticks). When it runs out: a chime and a toast in
// the app, and (with notifications on) a push from the server, which buzzes the phone even when
// it's locked. The push is set when the timer starts and moved or cancelled with it.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { haptic } from './haptics.js';
import { toast } from './toast.js';
import { chime } from './chime.js';
import { setPushTimer, clearPushTimer } from './push.js';
import { get, SETTINGS_ID } from '../store.js';

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

const notify = () => ({ rest: true, sound: true, ...((get(SETTINGS_ID) || {}).notify || {}) });

/** Tells the server when this rest ends (or that it was skipped). */
function syncPush() {
  if (timer && notify().rest) {
    setPushTimer('rest', timer.ends, {
      title: 'Rest’s up',
      body: timer.next ? `Next: ${timer.next}` : 'Time for the next set.',
      url: '/#train',
    });
  } else clearPushTimer('rest');
}

let alarm = null;
function arm() {
  clearTimeout(alarm);
  if (!timer) return;
  alarm = setTimeout(() => {
    haptic('big');
    if (notify().sound && document.visibilityState === 'visible') chime();
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
  syncPush();
  emit();
}
export function addRest(seconds) {
  if (!timer) return;
  timer = { ...timer, ends: timer.ends + seconds * 1000, total: timer.total + seconds };
  save();
  arm();
  syncPush();
  emit();
}
export function stopRest() {
  timer = null;
  clearTimeout(alarm);
  save();
  syncPush();
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
