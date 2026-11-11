// Reading and writing fit+ records. Every record lives in the shared store (store.js):
//   session  a lift day: body check, the prescribed items, every set you logged, back rating, notes
//   weigh    one weigh-in per day, only before you sign in (after that weigh-ins live in lifestyle+, see lifestyle.js)
//   food     a protein entry: { date, g, label }
//   cardio   { date, type: zone2 | bball | intervals | walk, min }
//   vert     a vertical jump test: { date, reach, jumps: [3 touches], best, vertical }
import { useMemo } from 'react';
import { useKind, put, get, remove, useSettings, saveSettings, SETTINGS_ID, currentUserId } from '../store.js';
import { useLifestyleWeights, putLifestyleWeight } from './lifestyle.js';
import { idFor, newId } from './ids.js';
import { todayISO } from './dates.js';
import { latestWeight, proteinTarget } from './engine.js';

export const useSessions = () => useKind('session');
/**
 * Weigh-ins: lifestyle+'s (typed there or imported from Apple Health) plus any fit+ saved on this device
 * before it was linked. lifestyle+ wins when both have the same day.
 */
export function useWeighs() {
  const mine = useKind('weigh');
  const shared = useLifestyleWeights();
  return useMemo(() => {
    if (!shared.length) return mine;
    const days = new Set(shared.map((w) => w.date));
    return [...shared, ...mine.filter((w) => !days.has(w.date))];
  }, [mine, shared]);
}
export const useFood = () => useKind('food');
export const useCardio = () => useKind('cardio');
export const useVerts = () => useKind('vert');

/** The session you're in the middle of (body check or lifting), if any. */
export function useOpenSession() {
  const sessions = useSessions();
  return useMemo(() => sessions.filter((s) => s.status !== 'done').sort((a, b) => b.date.localeCompare(a.date))[0] || null, [sessions]);
}

/** Today's protein target from your latest weigh-in (or the body weight in Settings). */
export function useProteinTarget() {
  const weighs = useWeighs();
  const s = useSettings();
  return proteinTarget(latestWeight(weighs, s), s.proteinPerLb);
}

/* ---------- Writing ---------- */

/** Signed in: straight into lifestyle+'s weigh-ins. Not signed in (or sample data): kept in fit+ for now. */
export function logWeight(lb, date = todayISO()) {
  const s = get(SETTINGS_ID) || {};
  if (currentUserId() && !s.sample) return putLifestyleWeight(date, lb);
  return put('weigh', { id: idFor(`weigh:${date}`), date, lb: Number(lb) });
}

export function logProtein(g, label = '', date = todayISO()) {
  return put('food', { id: newId(), date, g: Math.round(Number(g)), label: label.trim(), at: new Date().toISOString() });
}

export function logCardio(type, min, date = todayISO()) {
  return put('cardio', { id: newId(), date, type, min: Math.round(Number(min)) || 0, at: new Date().toISOString() });
}

export function saveMeal(name, g) {
  const s = get(SETTINGS_ID) || {};
  const meals = s.meals || [];
  saveSettings({ meals: [...meals, { id: newId(), name: name.trim(), g: Math.round(Number(g)) }] });
}
export function removeMeal(id) {
  const s = get(SETTINGS_ID) || {};
  saveSettings({ meals: (s.meals || []).filter((m) => m.id !== id) });
}

export const deleteRecord = (id) => remove(id);
