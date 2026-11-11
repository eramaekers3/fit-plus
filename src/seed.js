// Sample data for a first look: two and a bit weeks of the program, weigh-ins, protein, cardio and a
// vertical baseline. Every record is marked sample, never syncs, and goes away with "Clear it".
import { putMany, saveSettings, DEFAULT_SETTINGS } from './store.js';
import { prescribe } from './lib/engine.js';
import { todayISO, addDays, weekStart } from './lib/dates.js';
import { idFor } from './lib/ids.js';

export function seed() {
  const today = todayISO();
  const start = addDays(weekStart(today), -14); // you're in week 3
  let r = 7;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const settings = {
    ...DEFAULT_SETTINGS,
    sample: true,
    programStart: start,
    nextWeights: { trapbar: 225, bench: 185, frontsquat: 155, bss: 40, csrow: 50, pallof: 30, hipthrust: 135, dbrow: 60, legpress: 270, inclinedb: 50, hamcurl: 80, calf: 140, slrdl: 40, dbpress: 45, lateral: 20, pushdown: 50, curl: 30, carry: 70 },
  };
  const out = [];
  const sessions = [];
  const plan = [
    [0, 'd1'], [2, 'd2'], [4, 'd3'],
    [7, 'd1'], [9, 'd2'], [11, 'd3'],
    [14, 'd1'],
  ];
  for (const [off, day] of plan) {
    const date = addDays(start, off);
    if (date >= today) break;
    const sore = off === 9 ? { quads: 2, glutes: 1 } : off === 11 ? { hamstrings: 1 } : off === 14 ? { chest: 1 } : {};
    const check = { sore, bball: off === 7, sleep: off === 9 ? 6 : 8 };
    const p = prescribe({ day, date, sessions, settings, check });
    const items = p.items.map((it) => {
      if (it.skipped) return { ...it, log: [] };
      const log = Array.from({ length: it.sets }, (_, i) => {
        if (it.kind === 'jump') return { reps: 3, h: day === 'd1' ? 30 + Math.round(rand() * 2) : null };
        const tired = i === it.sets - 1 && rand() < 0.35;
        const reps = it.kind === 'acc' ? Math.min(it.hi, it.reps + (rand() < 0.5 ? 1 : 0) - (tired ? 1 : 0)) : it.reps;
        return { w: it.w, reps, rir: it.kind === 'main' ? (tired ? 1 : 2) : tired ? 0 : 1 };
      });
      return { ...it, log };
    });
    const s = {
      id: idFor(`sample-session-${date}`),
      sample: true,
      day,
      date,
      status: 'done',
      week: p.week,
      block: p.block,
      deload: p.deload,
      check,
      minimal: false,
      notes: p.notes.map((n) => n.text),
      items,
      warm: {},
      backPain: off === 7 ? 4 : Math.round(rand() * 2),
      trigger: off === 7 ? 'trapbar' : '',
      startedAt: `${date}T17:05:00`,
      finishedAt: `${date}T18:02:00`,
      prs: [],
    };
    sessions.push(s);
    // The hand-set starting weights are used once, like in the real app.
    for (const it of items) delete settings.nextWeights[it.ex];
  }
  sessions.forEach((s) => out.push(['session', s]));

  // Weigh-ins: about 227.5 climbing toward 230 over three weeks, with day-to-day noise.
  for (let i = 20; i >= 0; i--) {
    const date = addDays(today, -i);
    if (rand() < 0.15) continue;
    const lb = Math.round((227.5 + (20 - i) * 0.1 + (rand() - 0.5) * 1.6) * 10) / 10;
    out.push(['weigh', { id: idFor(`weigh:${date}`), sample: true, date, lb }]);
  }

  // Protein: the last week, a few entries a day.
  const meals = [['Protein shake', 25], ['Chicken bowl', 42], ['Greek yogurt', 20], ['3 eggs', 18], ['Burger + fries', 34], ['Fairlife milk', 13], ['Turkey wrap', 30]];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const n = i === 0 ? 2 : 5 + Math.round(rand() * 2);
    for (let k = 0; k < n; k++) {
      const [label, g] = meals[Math.floor(rand() * meals.length)];
      out.push(['food', { id: idFor(`sample-food-${date}-${k}`), sample: true, date, g, label, at: `${date}T${String(8 + k * 3).padStart(2, '0')}:00:00` }]);
    }
  }

  // Cardio: zone 2 on Tuesdays and Thursdays, basketball on Saturdays.
  for (let off = 0; off < 21; off++) {
    const date = addDays(start, off);
    if (date >= today) break;
    const dow = off % 7;
    if (dow === 1 || dow === 3) out.push(['cardio', { id: idFor(`sample-cardio-${date}`), sample: true, date, type: 'zone2', min: 35 + Math.round(rand() * 10) }]);
    if (dow === 5) out.push(['cardio', { id: idFor(`sample-cardio-${date}`), sample: true, date, type: 'bball', min: 75 }]);
    if (dow === 6) out.push(['cardio', { id: idFor(`sample-walk-${date}`), sample: true, date, type: 'walk', min: 40 }]);
  }

  out.push(['vert', { id: idFor('sample-vert'), sample: true, date: addDays(start, -3), reach: 108, jumps: [132, 133, 132.5], best: 133, vertical: 25 }]);

  putMany(out);
  saveSettings({ ...settings, nextWeights: {} });
}
