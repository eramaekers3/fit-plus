// The workout engine. Everything here is plain functions of your logs and settings, so each day's
// workout can be worked out (and re-worked out) without storing anything extra.
//
//   weekInfo      which week of the 8 you're in, and what that week means
//   prescribe     a day's workout: exercises, sets, target weight and reps, rest, and why it changed
//   nextDay       which lift day is up next this week
//   weekSummary   lifts done, zone 2 minutes, hard sessions, sets per muscle
//   e1rm, prsIn   estimated max and personal records

import { EXERCISES, DAYS, DAY_IDS, PHASES, MUSCLES, LEG_MUSCLES, muscleName, exName, CARDIO_TYPES } from './program.js';
import { parse, addDays, weekStart } from './dates.js';

/* ---------- Small helpers ---------- */
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const roundTo = (x, step = 5) => Math.max(0, Math.round(x / step) * step);
export const done = (sessions) => sessions.filter((s) => s.status === 'done');
const byDateDesc = (a, b) => (b.date === a.date ? (b.finishedAt || '').localeCompare(a.finishedAt || '') : b.date.localeCompare(a.date));

/** Estimated one-rep max (Epley), counting the reps you had left in the tank. */
export const e1rm = (w, reps, rir = 0) => (w > 0 && reps > 0 ? w * (1 + (reps + (rir || 0)) / 30) : 0);
/** The weight you could do for `reps` with `rir` left, from an estimated max. */
export const weightFor = (max, reps, rir = 2) => max / (1 + (reps + rir) / 30);

/* ---------- Weeks ---------- */

/**
 * Where a date falls in the program. Week 0 is any time before week 1 (your baseline week).
 * After week 8 the block starts again at week 1, with your new numbers.
 */
export function weekInfo(date, start) {
  if (!start) return { week: null, block: 0, phase: null };
  const d = daysBetween(start, date);
  if (d < 0) return { week: 0, block: 0, phase: PHASES[0], startsIn: -d };
  const w = Math.floor(d / 7);
  const week = (w % 8) + 1;
  return { week, block: Math.floor(w / 8) + 1, phase: PHASES[week], weekStart: addDays(start, w * 7) };
}

/* ---------- History ---------- */

/** Finished items for an exercise, newest first: [{ date, week, deload, item }] (only ones you logged sets for). */
export function historyOf(sessions, exId, before) {
  const out = [];
  for (const s of done(sessions).sort(byDateDesc)) {
    if (before && s.date > before) continue;
    for (const it of s.items || []) {
      if (it.ex === exId && (it.log || []).length) out.push({ date: s.date, week: s.week, deload: !!s.deload, item: it, session: s });
    }
  }
  return out;
}

/** The weight you actually worked at: the heaviest weight you did at least one full set with, else the heaviest. */
function workingWeight(item) {
  const sets = item.log || [];
  const full = sets.filter((x) => x.reps >= (item.reps || item.lo || 1));
  const pool = full.length ? full : sets;
  return Math.max(0, ...pool.map((x) => Number(x.w) || 0));
}

const bestE1 = (item) => Math.max(0, ...(item.log || []).map((x) => e1rm(Number(x.w) || 0, x.reps, x.rir)));

/* ---------- Prescribing a day ---------- */

/**
 * Builds a day's workout.
 *   day:      'd1' | 'd2' | 'd3'
 *   date:     'YYYY-MM-DD'
 *   sessions: every session record
 *   settings: app settings (programStart, swaps, nextWeights)
 *   check:    { sore: { muscleId: 0-3 }, bball: bool, sleep: hours|null }
 *   minimal:  true for the short version (jumps + main lift)
 *
 * Returns { week, block, phase, deload, items: [...], notes: [{ text, kind }] }.
 * Each item: { key, ex, name, kind, sets, reps, lo, hi, w, base, rir, rest, ss, perSide, unit, inc, skipped, why[] }
 */
export function prescribe({ day, date, sessions, settings, check = {}, minimal = false }) {
  const wk = weekInfo(date, settings.programStart);
  const phase = wk.phase || PHASES[1];
  const deload = !!phase.deload;
  const sore = check.sore || {};
  const s = (m) => Number(sore[m]) || 0;
  const legs = Math.max(0, ...LEG_MUSCLES.map(s));
  const lowback = s('lowback');
  const notes = [];
  const swaps = settings.swaps || {};
  const nextW = settings.nextWeights || {};

  // The last finished session's back rating, if it was over 3/10.
  const prior = done(sessions).filter((x) => x.date < date || (x.date === date && x.finishedAt)).sort(byDateDesc)[0];
  const backFlare = prior && Number(prior.backPain) > 3 ? Number(prior.backPain) : 0;

  if (deload) notes.push({ kind: 'week', text: `Deload week: half the sets, same weights${phase.test ? '. Retest your vertical at the end of the week.' : '.'}` });
  if (check.bball && !deload) notes.push({ kind: 'bball', text: 'Basketball yesterday: jump sets cut in half.' });
  if (legs >= 2) notes.push({ kind: 'sore', text: 'Legs sore: jump sets cut in half (tired jumps are low quality and hard on the joints).' });
  if (lowback >= 2) notes.push({ kind: 'back', text: 'Low back sore: back-friendly swaps are on and spine-loading lifts are lighter.' });
  if (backFlare) notes.push({ kind: 'back', text: `Your back was ${backFlare}/10 last session: lower-body main lifts are 10% lighter today.` });
  if (check.sleep != null && check.sleep !== '' && Number(check.sleep) < 6 && !minimal)
    notes.push({ kind: 'sleep', text: `Short night (${check.sleep} h). Consider the minimum session: jumps and the main lift.`, offerMinimal: true });
  if (minimal) notes.push({ kind: 'minimal', text: 'Minimum session: jumps and the main lift. Cut sets, not load.' });

  const items = DAYS[day].slots.map((slot, i) => {
    let exId = swaps[slot.ex] || slot.ex;
    const why = [];
    // A sore low back swaps the front squat for split squats.
    if (lowback >= 2 && (slot.ex === 'frontsquat') && EXERCISES[exId].lowBack) {
      exId = 'splitsquat';
      why.push('Swapped for split squats: low back sore');
    }
    const ex = EXERCISES[exId];
    const actsMain = slot.main && ex.kind === 'main';
    const kind = ex.kind === 'jump' ? 'jump' : actsMain ? 'main' : 'acc';

    let sets;
    let lo;
    let hi;
    if (slot.main && actsMain) {
      [sets, lo] = phase.main;
      hi = lo;
    } else if (slot.main) {
      // The main slot with a non-main stand-in (split squats): steady hypertrophy work.
      sets = 3;
      lo = 6;
      hi = 8;
    } else {
      sets = slot.sets;
      lo = slot.lo;
      hi = slot.hi;
    }

    let rir = kind === 'main' ? 2 : kind === 'acc' ? 1 : null;
    let mult = 1;
    let skipped = null;

    if (deload) sets = kind === 'jump' ? 2 : Math.ceil(sets / 2);

    if (kind === 'jump') {
      if (!deload && (check.bball || legs >= 2)) {
        sets = Math.ceil(sets / 2);
        why.push(check.bball ? 'Half the jumps: basketball yesterday' : 'Half the jumps: legs sore');
      }
    } else {
      const muscles = [...ex.muscles, ...(ex.lowBack ? ['lowback'] : [])];
      const worst = Math.max(0, ...muscles.map(s));
      const worstName = muscles.reduce((a, m) => (s(m) > s(a) ? m : a), muscles[0]);
      if (kind === 'main') {
        if (worst >= 2) {
          sets = Math.max(1, sets - 1);
          rir = 3;
          why.push(`One set fewer, aim for 3 in the tank: ${muscleName(worstName).toLowerCase()} sore`);
        }
        if (worst >= 3) {
          mult = Math.min(mult, 0.9);
          why.push('10% lighter today');
        }
        if (lowback >= 2 && ex.lowBack) {
          mult = Math.min(mult, 0.85);
          rir = 3;
          if (!why.some((w) => w.includes('lighter'))) why.push('15% lighter: low back sore');
        }
        if (backFlare && ex.lowBack) {
          mult = Math.min(mult, 0.9);
          if (!why.some((w) => w.includes('lighter'))) why.push('10% lighter: back flared last session');
        }
      } else {
        if (worst >= 3) {
          skipped = `${muscleName(worstName)} very sore`;
        } else if (worst >= 2) {
          sets = Math.max(1, sets - 1);
          why.push(`One set fewer: ${muscleName(worstName).toLowerCase()} sore`);
        }
        if (minimal && !skipped) skipped = 'Minimum session';
      }
    }

    // Target weight and reps.
    const target = targetFor({ exId, kind, lo, hi, date, deload, sessions, override: nextW[exId] });
    let w = target.w;
    if (w != null && mult < 1) w = roundTo(w * mult, ex.inc || 5);
    if (target.why) why.unshift(target.why);

    return {
      key: `${i}-${exId}`,
      slot: slot.ex,
      ex: exId,
      name: ex.name,
      kind,
      sets,
      lo,
      hi,
      reps: kind === 'acc' ? target.reps : lo,
      w,
      base: target.w,
      mult,
      rir,
      rest: slot.rest,
      ss: slot.ss || null,
      perSide: !!ex.perSide,
      unit: ex.unit || 'reps',
      inc: ex.inc || 5,
      bw: !!ex.bw,
      assist: !!ex.assist,
      cue: ex.cue,
      lastBest: target.lastBest,
      skipped,
      why,
      log: [],
    };
  });

  return { week: wk.week, block: wk.block, phase, deload, items, notes };
}

/**
 * The weight (and, for hypertrophy work, the reps) to aim for, from your history.
 *   main lifts:  same scheme as last time → +5 lb if every rep was there with 2+ in the tank, the same
 *                weight if you missed reps or went to failure, 5% less if you missed reps on 2+ sets.
 *                New scheme (4 × 5 → 5 × 3) → worked out from your estimated max.
 *                Deload → the same weight as your last normal week.
 *   hypertrophy: hit the top of the range on every set → add weight and start at the bottom of the range;
 *                otherwise same weight, one more rep than your worst set.
 */
export function targetFor({ exId, kind, lo, hi, date, deload, sessions, override }) {
  const ex = EXERCISES[exId];
  const inc = ex.inc || 5;
  const hist = historyOf(sessions, exId, date).filter((h) => !(h.date === date && !h.session.finishedAt));
  if (kind === 'jump') {
    const heights = hist.flatMap((h) => h.item.log.map((x) => Number(x.h) || 0));
    return { w: null, reps: 3, lastBest: heights.length ? Math.max(...heights) : null };
  }
  if (override != null && override !== '') return { w: Number(override), reps: lo, why: 'Weight set by you' };
  const normal = hist.filter((h) => !h.deload);
  const last = normal[0] || hist[0];
  if (!last) return { w: ex.bw ? 0 : null, reps: lo, why: ex.bw ? null : ex.assist ? 'First time: pick enough help to get the reps' : 'First time: pick a starting weight' };

  const it = last.item;
  const lastW = it.mult && it.mult < 1 && it.base != null ? it.base : workingWeight(it);
  const sameWeek = weekStart(last.date) === weekStart(date);

  if (deload || sameWeek) return { w: lastW, reps: kind === 'acc' ? it.reps || lo : lo };

  if (kind === 'main') {
    const lastReps = it.lo;
    if (lastReps !== lo) {
      // Best of your last few normal weeks, skipping days that were eased for soreness or your back.
      const pool = normal.slice(0, 3).filter((h) => !(h.item.mult < 1));
      const max = Math.max(...(pool.length ? pool : normal.slice(0, 1)).map((h) => bestE1(h.item)));
      const w = roundTo(weightFor(max, lo, 2), inc);
      return { w, reps: lo, why: `New scheme: worked out from your estimated max (${Math.round(max)} lb)` };
    }
    const sets = it.log;
    const misses = sets.filter((x) => x.reps < lastReps).length;
    const minRir = Math.min(...sets.map((x) => (x.rir == null ? 2 : x.rir)));
    const eased = it.mult && it.mult < 1;
    if (misses >= 2) return { w: roundTo(lastW * 0.95, inc), reps: lo, why: 'Missed reps last time: 5% lighter' };
    if (misses || minRir < 2 || eased || sets.length < Math.min(it.sets, 3)) return { w: lastW, reps: lo, why: 'Same weight: own it before adding more' };
    return { w: lastW + inc, reps: lo, why: `+${inc} lb: every rep last time with 2+ in the tank` };
  }

  // Hypertrophy: double progression.
  const sets = it.log;
  const top = it.hi || hi;
  const allTop = sets.length >= Math.min(it.sets || 1, 3) && sets.every((x) => x.reps >= top);
  if (allTop && ex.assist) {
    // Assisted: progress means less help. At zero help it's a real pull-up.
    if (lastW <= inc) return { w: 0, reps: lo, why: 'No help needed: time to swap to real pull-ups in Plan' };
    return { w: lastW - inc, reps: lo, why: `${inc} lb less help: top of the range on every set` };
  }
  if (allTop) return { w: lastW + inc, reps: lo, why: `+${inc} lb: top of the range on every set` };
  const worst = Math.min(...sets.map((x) => x.reps));
  return { w: lastW, reps: Math.max(lo, Math.min(hi, worst + 1)) };
}

/* ---------- Which day is next ---------- */

/** Lift days finished in the week of `date`, and the first one not done yet (null when all three are). */
export function nextDay(sessions, date) {
  const ws = weekStart(date);
  const doneThisWeek = new Set(done(sessions).filter((s) => weekStart(s.date) === ws).map((s) => s.day));
  const next = DAY_IDS.find((d) => !doneThisWeek.has(d)) || null;
  const liftedYesterday = done(sessions).some((s) => s.date === addDays(date, -1));
  const liftedToday = done(sessions).some((s) => s.date === date);
  return { next, doneThisWeek, liftedYesterday, liftedToday };
}

/* ---------- Weekly totals ---------- */

/** Sets per muscle in a list of sessions: a full set for main muscles, half for the secondary ones. */
export function setsPerMuscle(sessions) {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
  for (const s of done(sessions)) {
    for (const it of s.items || []) {
      if (it.kind === 'jump') continue;
      const ex = EXERCISES[it.ex];
      const n = (it.log || []).length;
      if (!ex || !n) continue;
      ex.muscles.forEach((m) => (out[m] += n));
      (ex.also || []).forEach((m) => (out[m] += n / 2));
    }
  }
  return out;
}

export function weekSummary({ date, sessions, cardio, goal = 150 }) {
  const ws = weekStart(date);
  const we = addDays(ws, 6);
  const inWeek = (d) => d >= ws && d <= we;
  const lifts = done(sessions).filter((s) => inWeek(s.date));
  const c = cardio.filter((x) => inWeek(x.date));
  const z2 = c.filter((x) => x.type === 'zone2' || x.type === 'walk').reduce((t, x) => t + (Number(x.min) || 0), 0);
  const hard = c.filter((x) => (CARDIO_TYPES.find((t) => t.id === x.type) || {}).hard).length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    return {
      date: d,
      lift: lifts.find((s) => s.date === d) || null,
      cardio: c.filter((x) => x.date === d),
    };
  });
  return { ws, we, lifts, z2, z2Goal: goal, hard, days, muscles: setsPerMuscle(lifts) };
}

/* ---------- Records ---------- */

/** Personal records set in a session: a new best estimated max for an exercise. */
export function prsIn(session, sessions) {
  const out = [];
  for (const it of session.items || []) {
    if (it.kind === 'jump') {
      const h = Math.max(0, ...(it.log || []).map((x) => Number(x.h) || 0));
      if (!h) continue;
      const before = historyOf(sessions.filter((s) => s.id !== session.id), it.ex, session.date)
        .flatMap((x) => x.item.log.map((l) => Number(l.h) || 0));
      if (before.length && h > Math.max(...before)) out.push({ ex: it.ex, text: `${exName(it.ex)}: ${h} in`, value: h });
      continue;
    }
    if (it.bw || it.assist) continue;
    const best = bestE1(it);
    if (!best) continue;
    const before = historyOf(sessions.filter((s) => s.id !== session.id), it.ex, session.date).map((x) => bestE1(x.item));
    if (before.length && best > Math.max(...before) + 0.5) {
      const top = (it.log || []).reduce((a, x) => (e1rm(x.w, x.reps, x.rir) > e1rm(a.w, a.reps, a.rir) ? x : a), it.log[0]);
      out.push({ ex: it.ex, text: `${exName(it.ex)}: ${top.w} × ${top.reps}`, value: Math.round(best) });
    }
  }
  return out;
}

/** Estimated max over time for one exercise: [{ date, v }] oldest first. */
export function e1Series(sessions, exId) {
  return historyOf(sessions, exId)
    .map((h) => ({ date: h.date, v: Math.round(bestE1(h.item)) }))
    .filter((p) => p.v > 0)
    .reverse();
}

/* ---------- Soreness patterns ---------- */

/** Muscles you rated sore (2+) before most sessions in the last two weeks. */
export function sorePatterns(sessions, date) {
  const from = addDays(date, -14);
  const recent = done(sessions).filter((s) => s.date > from && s.check && s.check.sore);
  if (recent.length < 3) return [];
  return MUSCLES.map((m) => {
    const n = recent.filter((s) => (Number(s.check.sore[m.id]) || 0) >= 2).length;
    return { id: m.id, name: m.name, n, of: recent.length };
  }).filter((x) => x.n / x.of >= 0.6);
}

/* ---------- Body ---------- */

/** Average of weigh-ins in the 7 days ending on `date` (null if none). */
export function avg7(weighs, date) {
  const from = addDays(date, -6);
  const w = weighs.filter((x) => x.date >= from && x.date <= date).map((x) => Number(x.lb)).filter(Boolean);
  return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
}

export function latestWeight(weighs, settings) {
  const last = [...weighs].sort((a, b) => b.date.localeCompare(a.date))[0];
  return last ? Number(last.lb) : Number(settings.bodyweight) || 0;
}

export const proteinTarget = (weight, perLb = 0.8) => Math.round((Number(weight) || 0) * (Number(perLb) || 0.8) / 5) * 5;

/** How the weekly weight change compares with the 0.25–0.5 lb a week target. */
export function weightTrend(weighs, date) {
  const now = avg7(weighs, date);
  const then = avg7(weighs, addDays(date, -7));
  if (now == null || then == null) return { now, rate: null, verdict: null };
  const rate = now - then;
  const verdict =
    rate > 0.75 ? { tone: 'neg', text: 'Gaining faster than ~0.5 lb a week. Trim a snack or a sugary drink.' }
    : rate >= 0.15 ? { tone: 'pos', text: 'Right on target for adding muscle. Keep eating like this.' }
    : rate > -0.15 ? { tone: '', text: 'Holding steady. If it stays flat 2–3 weeks, add a snack.' }
    : { tone: 'neg', text: 'Trending down. Add a snack or a shake if you’re trying to build.' };
  return { now, rate, verdict };
}
