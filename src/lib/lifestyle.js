// Weigh-ins are shared with lifestyle+. lifestyle+ keeps one `weight` record per day in its own
// `records` table (typed in there, or imported from Apple Health); fit+ reads those and writes new
// weigh-ins straight into the same rows, so both apps always show the same list.
//
// Same account, same Supabase project: the `records` table's own row-level security lets you read and
// write your rows from either app. Ids are the same as lifestyle+ uses (one per day), so a weigh-in
// from either app for a date lands on the same row instead of making a duplicate.
//
// Offline or signed out, a weigh-in waits here and goes up on the next sync.
import { useSyncExternalStore } from 'react';
import { supabase } from '../supabase.js';
import { onSynced, currentUserId } from '../store.js';
import { idFor } from './ids.js';

const KEY = 'fitplus.lifestyleWeights';
const TABLE = 'records'; // lifestyle+'s table

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.rows) return { rows: raw.rows, pending: raw.pending || {}, lastPull: raw.lastPull || null, owner: raw.owner || null };
  } catch {
    /* storage unavailable */
  }
  return { rows: {}, pending: {}, lastPull: null, owner: null };
}

let st = load();
let list = [];
let linked = false; // true once a pull from lifestyle+ has worked on this device
const listeners = new Set();

function rebuild() {
  list = Object.values(st.rows)
    .filter((r) => !r.deleted && r.date && Number(r.lbs))
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
      .select('id, data, deleted, synced_at')
      .eq('kind', 'weight')
      .order('synced_at', { ascending: true })
      .range(from, from + 999);
    if (since) q = q.gt('synced_at', since);
    const { data, error } = await q;
    if (error) throw error;
    for (const row of data) {
      st.rows[row.id] = { ...(row.data || {}), id: row.id, deleted: row.deleted };
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
  st.rows[id] = { ...prev, id, date, lbs: Number(lbs), source: undefined, deleted: false };
  st.pending[id] = { id, date, lbs: Number(lbs), updated_at: new Date().toISOString() };
  save();
  emit();
  if (currentUserId()) syncWeights({ user: { id: currentUserId() } }).catch(() => {});
}

onSynced(syncWeights);
