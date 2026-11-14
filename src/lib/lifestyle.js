// Weigh-ins are shared with lifestyle+. lifestyle+ keeps one `weight` record per day in its own
// `records` table (typed in there, or imported from Apple Health); fit+ reads those and writes new
// weigh-ins straight into the same rows, so both apps always show the same list.
//
// Same account, same Supabase project: the `records` table's own row-level security lets you read and
// write your rows from either app. Ids are the same as lifestyle+ uses (one per day), so a weigh-in
// from either app for a date lands on the same row instead of making a duplicate.
//
// Offline or signed out, a weigh-in waits here and goes up on the next sync.
//
// It also reads (never writes) two more things from lifestyle+ for the week plan on Today:
// its settings (your Apple Calendar links and day hours) and your time blocks. And your recent
// Apple Health workouts (basketball, runs, walks), which the nightly stretch builds from.
import { useSyncExternalStore } from 'react';
import { supabase } from '../supabase.js';
import { onSynced, currentUserId } from '../store.js';
import { idFor } from './ids.js';

const KEY = 'fitplus.lifestyle.v3';
const OLD_KEY = 'fitplus.lifestyleWeights'; // weights only; replaced by v2 (adds settings and blocks)
const V2_KEY = 'fitplus.lifestyle.v2'; // replaced by v3 (adds Apple Health workouts)
const KINDS = ['weight', 'block', 'settings', 'healthworkout'];
const SETTINGS_ID = idFor('settings'); // lifestyle+'s settings record (same id scheme as fit+'s)
const TABLE = 'records'; // lifestyle+'s table

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.rows) return { rows: raw.rows, pending: raw.pending || {}, lastPull: raw.lastPull || null, owner: raw.owner || null };
    // Coming from an older version: keep anything still waiting to send, pull everything fresh.
    const v2 = JSON.parse(localStorage.getItem(V2_KEY));
    if (v2) {
      localStorage.removeItem(V2_KEY);
      return { rows: {}, pending: v2.pending || {}, lastPull: null, owner: v2.owner || null };
    }
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old) {
      localStorage.removeItem(OLD_KEY);
      return { rows: {}, pending: old.pending || {}, lastPull: null, owner: old.owner || null };
    }
  } catch {
    /* storage unavailable */
  }
  return { rows: {}, pending: {}, lastPull: null, owner: null };
}

let st = load();
let list = [];
let blocks = [];
let healthWorkouts = [];
let lsSettings = {};
let linked = false; // true once a pull from lifestyle+ has worked on this device
const listeners = new Set();

function rebuild() {
  const rows = Object.values(st.rows).filter((r) => !r.deleted);
  blocks = rows.filter((r) => r.kind === 'block' && r.date && r.end > r.start);
  healthWorkouts = rows.filter((r) => r.kind === 'healthworkout' && r.date);
  const set = st.rows[SETTINGS_ID];
  lsSettings = set && !set.deleted ? set : {};
  list = rows
    .filter((r) => (r.kind || 'weight') === 'weight' && r.date && Number(r.lbs))
    .map((r) => ({ id: r.id, date: r.date, lb: Number(r.lbs), source: r.source || 'lifestyle+' }));
  linked = !!st.lastPull;
}
rebuild();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    /* storage full or blocked */
  }
}
function emit() {
  rebuild();
  listeners.forEach((l) => l());
}

/** lifestyle+ weigh-ins on this device: [{ id, date, lb, source }]. */
export function useLifestyleWeights() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => list
  );
}
export const isLinked = () => linked;

const sub = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** lifestyle+ time blocks: [{ id, date, start, end, title, type }] (minutes from midnight). */
export const useLifestyleBlocks = () => useSyncExternalStore(sub, () => blocks);
/** Recent Apple Health workouts (via lifestyle+): [{ id, date, start, end, minutes, type }]. */
export const useHealthWorkouts = () => useSyncExternalStore(sub, () => healthWorkouts);
/** lifestyle+ settings: { calendars: [{ id, url }], dayStart, dayEnd, … } ({} until the first pull). */
export const useLifestyleSettings = () => useSyncExternalStore(sub, () => lsSettings);

const cutoff = () => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Pulls weigh-ins changed in lifestyle+ since last time, then sends any that were waiting. */
export async function syncWeights(session) {
  if (!supabase || !session) return;
  const uid = session.user.id;
  if (st.owner && st.owner !== uid) st = { rows: {}, pending: {}, lastPull: null, owner: uid };
  st.owner = uid;

  // Send waiting weigh-ins first, so a pull right after can't put an older value back.
  const waiting = Object.values(st.pending);
  if (waiting.length) {
    const rows = waiting.map((w) => ({ id: w.id, user_id: uid, kind: 'weight', data: { id: w.id, date: w.date, lbs: w.lbs }, updated_at: w.updated_at, deleted: false }));
    const { error } = await supabase.from(TABLE).upsert(rows);
    if (error) throw error;
    st.pending = {};
  }

  let maxSeen = st.lastPull ? Date.parse(st.lastPull) : 0;
  const since = st.lastPull ? new Date(Date.parse(st.lastPull) - 5000).toISOString() : null;
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from(TABLE)
      .select('id, kind, data, deleted, synced_at')
      .in('kind', KINDS)
      .order('synced_at', { ascending: true })
      .range(from, from + 999);
    if (since) q = q.gt('synced_at', since);
    const { data, error } = await q;
    if (error) throw error;
    for (const row of data) {
      // Old time blocks are no use for planning, so they aren't kept on the phone.
      // Same for old Apple Health workouts: only the last few days matter for the stretch.
      if ((row.kind === 'block' || row.kind === 'healthworkout') && row.data && row.data.date && row.data.date < cutoff()) {
        delete st.rows[row.id];
      } else {
        st.rows[row.id] = { ...(row.data || {}), id: row.id, kind: row.kind, deleted: row.deleted };
      }
      maxSeen = Math.max(maxSeen, Date.parse(row.synced_at));
    }
    if (data.length < 1000) break;
  }
  st.lastPull = new Date(maxSeen || Date.now()).toISOString();
  save();
  emit();
}

/** Saves a weigh-in into lifestyle+ (right away on this device; to the server on the next sync). */
export function putLifestyleWeight(date, lbs) {
  const id = idFor(`w:${date}`);
  const prev = st.rows[id] || {};
  st.rows[id] = { ...prev, id, kind: 'weight', date, lbs: Number(lbs), source: undefined, deleted: false };
  st.pending[id] = { id, date, lbs: Number(lbs), updated_at: new Date().toISOString() };
  save();
  emit();
  if (currentUserId()) syncWeights({ user: { id: currentUserId() } }).catch(() => {});
}

onSynced(syncWeights);
