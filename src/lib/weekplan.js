// The week plan on Today: where your lifts and cardio fit this week, around what's on your calendar.
//
// Rules, from the program:
//   - 3 lifts a week, on days you can lift (Mon, Wed, Thu, Fri by default), never two days in a row,
//     Mon/Wed/Fri preferred. Each needs ~75 min free (warm-up + ~60 min).
//   - Basketball on your basketball days counts as the hard session. With no game left this week and
//     no hard session logged, a 4 × 4 interval session goes on a free non-lift day.
//   - Zone 2 fills the non-lift days until you reach your weekly minutes (150): 30–45 min each,
//     Sunday as a long easy walk.
//   - A lifestyle+ block titled gym / lift / workout is taken as your lift time for that day.
//   - Times avoid calendar events and lifestyle+ blocks, with 15 min either side to get there,
//     and prefer 10 AM – 8:30 PM.
import { DAY_IDS } from './program.js';
import { addDays, weekStart, parse } from './dates.js';
import { done } from './engine.js';

const LIFT_MIN = 75;
const BUFFER = 15;

/** Free windows in a day: [{ start, end }] in minutes, between `from` and `to`. */
export function freeWindows(busy, from, to) {
  const spans = busy
    .map((b) => [Math.max(from, b.start - BUFFER), Math.min(to, b.end + BUFFER)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = from;
  for (const [s, e] of spans) {
    if (s > cur) out.push({ start: cur, end: s });
    cur = Math.max(cur, e);
  }
  if (cur < to) out.push({ start: cur, end: to });
  return out;
}

const up15 = (m) => Math.ceil(m / 15) * 15;

/** A start time for `dur` minutes: the earliest fit between 10:00 and 20:30 if there is one, else the earliest fit. */
export function findSlot(windows, dur) {
  const fits = (lo, hi) => {
    for (const w of windows) {
      const s = up15(Math.max(w.start, lo));
      if (s + dur <= Math.min(w.end, hi)) return { start: s, end: s + dur };
    }
    return null;
  };
  return fits(600, 1230) || fits(0, 1440);
}

/** Every way to pick `k` of `items` (k is at most 3 and items at most 7, so this stays tiny). */
function combos(items, k) {
  if (k === 0) return [[]];
  const out = [];
  items.forEach((x, i) => combos(items.slice(i + 1), k - 1).forEach((rest) => out.push([x, ...rest])));
  return out;
}

/**
 * Plans the week containing `today`.
 *   busy:      useBusyDays() result ({ days, dayStart, dayEnd, … })
 *   sessions, cardio: records
 *   settings:  { liftDays: [1..7 with 1 = Mon], bballDays, zone2Goal }
 *   now:       minutes since midnight
 * Returns { days: [{ date, past, today, done: [...], plan: [...], free }], notes: [] }.
 * A plan item: { type: 'lift' | 'zone2' | 'walk' | 'bball' | 'intervals' | 'rest', label, start?, end?, day? }
 */
export function planWeek({ today, now, busy, sessions, cardio, settings }) {
  const ws = weekStart(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const dow = (d) => ((parse(d).getDay() + 6) % 7) + 1; // 1 = Mon … 7 = Sun
  const liftDays = settings.liftDays && settings.liftDays.length ? settings.liftDays : [1, 3, 4, 5];
  const bballDays = settings.bballDays || [6];
  const goal = Number(settings.zone2Goal) || 150;
  const from = Math.max(6, Number(busy.dayStart) || 7) * 60;
  const to = Math.min(22, Number(busy.dayEnd) || 22) * 60;
  const notes = [];

  const lifts = done(sessions).filter((s) => s.date >= ws && s.date <= dates[6]);
  const doneIds = new Set(lifts.map((s) => s.day));
  const liftDates = new Set(lifts.map((s) => s.date));
  const openToday = sessions.some((s) => s.status !== 'done' && s.date === today);
  const weekCardio = cardio.filter((c) => c.date >= ws && c.date <= dates[6]);
  const z2Done = weekCardio.filter((c) => c.type === 'zone2' || c.type === 'walk').reduce((t, c) => t + (Number(c.min) || 0), 0);
  const hardDone = weekCardio.some((c) => c.type === 'bball' || c.type === 'intervals');
  const prevWeekLift = done(sessions).some((s) => s.date === addDays(ws, -1));

  // Free time per day (today only from now on).
  const win = {};
  for (const d of dates) {
    const b = (busy.days && busy.days[d]) || { busy: [], gym: [] };
    const start = d === today ? Math.max(from, up15(now + 20)) : from;
    win[d] = d < today ? [] : freeWindows(b.busy, start, to);
  }
  /** Takes a planned slot out of a day's free windows. */
  const reserve = (d, slot) => {
    win[d] = win[d].flatMap((w) => {
      if (slot.end <= w.start || slot.start >= w.end) return [w];
      return [{ start: w.start, end: slot.start }, { start: slot.end, end: w.end }].filter((x) => x.end - x.start >= 15);
    });
  };
  const free = (d) => win[d].reduce((t, w) => t + (w.end - w.start), 0);
  const gymBlock = (d) => {
    const g = ((busy.days && busy.days[d]) || {}).gym || [];
    const upcoming = d === today ? g.filter((x) => x.end > now) : g;
    return upcoming[0] || null;
  };

  /* ---- Lifts ---- */
  const remaining = DAY_IDS.filter((id) => !doneIds.has(id));
  const candidates = dates.filter((d) => {
    if (d < today || liftDates.has(d)) return false;
    if (d === today && openToday) return true;
    if (!liftDays.includes(dow(d)) && !gymBlock(d)) return false;
    return !!(gymBlock(d) || findSlot(win[d], LIFT_MIN));
  });
  const adjacentToDone = (d) => liftDates.has(addDays(d, -1)) || liftDates.has(addDays(d, 1)) || (d === ws && prevWeekLift);
  let best = [];
  for (let k = Math.min(remaining.length, candidates.length); k > 0 && !best.length; k--) {
    const ok = combos(candidates, k).filter((set) =>
      set.every((d, i) => !adjacentToDone(d) && (i === 0 || set[i - 1] !== addDays(d, -1)))
    );
    // Prefer the Mon/Wed/Fri rhythm, then earlier days.
    ok.sort((a, b) => b.filter((d) => [1, 3, 5].includes(dow(d))).length - a.filter((d) => [1, 3, 5].includes(dow(d))).length);
    if (ok.length) best = ok[0];
  }
  if (best.length < remaining.length) {
    const short = remaining.length - best.length;
    notes.push(
      best.length + lifts.length === 0
        ? 'No ~75-minute gap on a lift day this week. A minimum session (jumps + main lift, ~35 min) still counts.'
        : `Room for ${lifts.length + best.length} of 3 lifts this week without back-to-back days. ${short === 1 ? 'Skip one, or do a minimum session' : 'Do minimum sessions'} where a shorter gap fits.`
    );
  }
  const plan = Object.fromEntries(dates.map((d) => [d, []]));
  best.forEach((d, i) => {
    const g = gymBlock(d);
    const slot = g ? { start: g.start, end: g.end } : d === today && openToday ? null : findSlot(win[d], LIFT_MIN);
    plan[d].push({ type: 'lift', day: remaining[i], label: `Day ${remaining[i].slice(1)}`, ...(slot || {}), fromBlock: !!g });
    if (slot) reserve(d, slot);
  });
  const liftPlanned = new Set(best);

  /* ---- Basketball / hard session ---- */
  let hardPlanned = false;
  for (const d of dates) {
    if (d < today || !bballDays.includes(dow(d))) continue;
    if (weekCardio.some((c) => c.date === d && c.type === 'bball')) continue;
    plan[d].push({ type: 'bball', label: 'Basketball' });
    hardPlanned = true;
  }
  if (!hardDone && !hardPlanned) {
    const d = dates.find((x) => x >= today && !liftPlanned.has(x) && !liftDates.has(x) && findSlot(win[x], 30));
    if (d) {
      const slot = findSlot(win[d], 30);
      plan[d].push({ type: 'intervals', label: '4 × 4 intervals', ...slot });
      reserve(d, slot);
    } else notes.push('No hard session this week: basketball or 4 × 4 intervals both count.');
  }

  /* ---- Zone 2 ---- */
  let need = Math.max(0, goal - z2Done);
  for (const d of dates) {
    if (need <= 0) break;
    if (d < today || liftPlanned.has(d) || liftDates.has(d)) continue;
    if (plan[d].some((p) => p.type === 'bball' || p.type === 'intervals')) continue;
    if (weekCardio.some((c) => c.date === d)) continue;
    const sunday = dow(d) === 7;
    let dur = sunday ? 45 : need >= 45 ? 45 : Math.max(30, need);
    let slot = findSlot(win[d], dur);
    if (!slot && dur > 30) slot = findSlot(win[d], (dur = 30));
    if (!slot) continue;
    plan[d].push({ type: sunday ? 'walk' : 'zone2', label: sunday ? 'Long easy walk' : 'Zone 2', ...slot });
    reserve(d, slot);
    need -= dur;
  }
  if (need > 0) notes.push(`${need} min of zone 2 doesn’t fit on rest days. Add 15–20 min of incline walking after a lift.`);

  /* ---- Days ---- */
  return {
    notes,
    z2Done,
    z2Goal: goal,
    hardDone,
    days: dates.map((d) => {
      const doneItems = [
        ...lifts.filter((s) => s.date === d).map((s) => ({ type: 'lift', label: `Day ${s.day.slice(1)}`, id: s.id })),
        ...weekCardio.filter((c) => c.date === d).map((c) => ({ type: c.type, label: c.type === 'bball' ? 'Basketball' : c.type === 'walk' ? 'Walk' : c.type === 'intervals' ? 'Intervals' : 'Zone 2', min: c.min })),
      ];
      const p = plan[d];
      if (d >= today && !p.length && !doneItems.length) p.push({ type: 'rest', label: dow(d) === 7 ? 'Off' : 'Rest' });
      const b = (busy.days && busy.days[d]) || { busy: [], allDay: [] };
      return { date: d, past: d < today, today: d === today, done: doneItems, plan: p, free: d < today ? null : free(d), events: b.busy.length, allDay: b.allDay || [] };
    }),
  };
}
