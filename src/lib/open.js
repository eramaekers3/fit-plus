// Opens a sheet from anywhere (a card on Today, a row in Progress, the + button). App.jsx shows it.
import { useSyncExternalStore } from 'react';

let current = null; // { type, id, preset, key }
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const open = (type, id = null, preset = null) => {
  current = { type, id, preset, key: Date.now() };
  emit();
};
/** The quick-log sheet: 'protein' | 'weight' | 'cardio'. */
export const quickLog = (tab = 'protein') => open('quick', null, tab);
export const openSession = (id) => open('session', id);
export const openExercise = (exId) => open('exercise', exId);
export const openVert = () => open('vert');
export const closeSheet = () => {
  current = null;
  emit();
};

export function useOpenSheet() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current
  );
}

/** Switch tabs from inside a page. App.jsx listens for this. */
export const goTab = (id) => window.dispatchEvent(new CustomEvent('fit:go', { detail: id }));
