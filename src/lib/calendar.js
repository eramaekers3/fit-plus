// Your Apple Calendar, read through the same links lifestyle+ uses (from its settings), so the week
// plan on Today fits workouts around classes and plans. Read-only. Events are cached on this device
// so the plan still has times offline.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLifestyleSettings, useLifestyleBlocks } from './lifestyle.js';
import { addDays, todayISO, iso } from './dates.js';

const KEY = 'fitplus.calendar.v1';
const REFRESH_MS = 10 * 60 * 1000;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
// { [calendarId]: { events, fetchedAt, error, loading } }
let cache = load();
const listeners = new Set();
function set(id, changes) {
  cache = { ...cache, [id]: { ...(cache[id] || {}), ...changes } };
  try {
    const keep = {};
    for (const [k, v] of Object.entries(cache)) keep[k] = { events: v.events, fetchedAt: v.fetchedAt };
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function refresh(cal) {
  const prev = cache[cal.id];
  if (prev && (prev.loading || (prev.fetchedAt && Date.now() - prev.fetchedAt < REFRESH_MS))) return;
  set(cal.id, { loading: true });
  const t = todayISO();
  try {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cal.url, from: addDays(t, -7), to: addDays(t, 14) }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* not JSON */
    }
    if (!res.ok) throw new Error(data.error || 'Couldn’t reach the calendar service.');
    set(cal.id, { events: data.events, fetchedAt: Date.now(), error: null, loading: false });
  } catch (e) {
    set(cal.id, { error: e.message, loading: false });
  }
}

const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();

/**
 * Everything that makes you busy, by day:
 *   { [date]: { busy: [{ start, end, title, kind: 'cal' | 'block' }], gym: [{ start, end }], allDay: [title] } }
 * lifestyle+ time blocks you've titled gym / lift / workout are kept apart as `gym`: the plan uses them
 * as your lift time instead of treating them as busy.
 * Also returns { calendars: n, loaded: bool } so the card can say where times come from.
 */
export function useBusyDays() {
  const ls = useLifestyleSettings();
  const blocks = useLifestyleBlocks();
  const c = useSyncExternalStore(subscribe, () => cache);
  const calendars = useMemo(() => (ls.calendars || []).filter((x) => x && x.url), [ls.calendars]);
  const key = calendars.map((x) => x.id + x.url).join('|');

  useEffect(() => {
    const run = () => calendars.forEach((x) => refresh(x));
    run();
    const onFocus = () => document.visibilityState !== 'hidden' && run();
    document.addEventListener('visibilitychange', onFocus);
    const t = setInterval(run, REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => {
    const days = {};
    const day = (d) => (days[d] = days[d] || { busy: [], gym: [], allDay: [] });
    let loaded = false;
    for (const cal of calendars) {
      const entry = c[cal.id];
      if (!entry || !entry.events) continue;
      loaded = true;
      for (const ev of entry.events) {
        if (ev.allDay) {
          for (let d = ev.start; d < ev.end; d = addDays(d, 1)) day(d).allDay.push(ev.title);
          continue;
        }
        const s = new Date(ev.start);
        const e = new Date(ev.end);
        for (let d = iso(s); d <= iso(e); d = addDays(d, 1)) {
          const start = d === iso(s) ? minutesOf(s) : 0;
          const end = d === iso(e) ? minutesOf(e) : 1440;
          if (end <= start) continue;
          day(d).busy.push({ start, end, title: ev.title, kind: 'cal' });
        }
      }
    }
    for (const b of blocks) {
      const isGym = /\b(gym|lift|lifting|workout|rec)\b/i.test(b.title || '');
      if (isGym) day(b.date).gym.push({ start: b.start, end: b.end });
      else day(b.date).busy.push({ start: b.start, end: b.end, title: b.title || 'Block', kind: 'block' });
    }
    return { days, calendars: calendars.length, loaded, blocks: blocks.length, dayStart: ls.dayStart, dayEnd: ls.dayEnd };
  }, [calendars, c, blocks, ls.dayStart, ls.dayEnd]);
}
