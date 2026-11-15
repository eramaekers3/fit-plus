// Decides which fit+ reminders are due right now for one person. No database or network here,
// so it can be tested on its own; api/push-tick.js gathers the data and does the sending.

// Defaults for Settings → Notifications. Times are minutes after midnight; days are 1 = Mon … 7 = Sun.
export const DEFAULT_NOTIFY = {
  rest: true, // push when the rest timer is up
  sound: true, // and a chime in the app
  lift: true, // lift-day morning reminder
  liftAt: 8 * 60,
  liftLead: true, // and a heads-up 30 min before a planned lift
  stretch: true,
  stretchAt: 21 * 60 + 30,
  weigh: true,
  weighDay: 1,
  weighAt: 7 * 60 + 30,
  cardio: true, // zone 2 check-in if you're behind for the week
  cardioDay: 4,
  cardioAt: 19 * 60,
};
export const LEAD = 30;

// The tick runs every minute; a few minutes of grace covers a late or skipped run. Each reminder
// has a key, and push_log makes sure a key is only ever sent once.
const GRACE = 4;
const isDue = (nowMin, target) => nowMin - target >= 0 && nowMin - target < GRACE;

const pad = (n) => String(n).padStart(2, '0');
export const minLabel = (m) => {
  let h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return mm ? `${h}:${pad(mm)} ${ap}` : `${h} ${ap}`;
};
export const addDays = (s, n) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** 1 = Mon … 7 = Sun */
export const dowOf = (s) => ((new Date(`${s}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
export const weekStartOf = (s) => addDays(s, 1 - dowOf(s));

/** The date and minute of the day where the phone is. */
export function localParts(d, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}

/** Whether any reminder could be due this minute, so the tick only reads data when it needs to. */
export function anyDue(notify, date, min) {
  const n = { ...DEFAULT_NOTIFY, ...(notify || {}) };
  const dow = dowOf(date);
  return (
    (n.lift && (isDue(min, n.liftAt) || n.liftLead)) ||
    (n.stretch && isDue(min, n.stretchAt)) ||
    (n.weigh && dow === n.weighDay && isDue(min, n.weighAt)) ||
    (n.cardio && dow === n.cardioDay && isDue(min, n.cardioAt))
  );
}

/**
 * Returns [{ key, title, body, url }] for reminders due at `now`.
 *   notify:     settings.notify
 *   lifts:      today's planned lifts from the week plan [{ label, start?, end?, main? }]
 *   liftedToday, stretched, weighedToday: booleans
 *   z2, z2Goal: zone 2 minutes logged this week, and the weekly goal
 */
export function dueNotifications({ now, tz, notify, lifts = [], liftedToday = false, stretched = false, weighedToday = false, z2 = 0, z2Goal = 150 }) {
  const n = { ...DEFAULT_NOTIFY, ...(notify || {}) };
  const { date, min } = localParts(now, tz);
  const dow = dowOf(date);
  const out = [];

  // 1. Lift day: in the morning, and 30 minutes before the planned time.
  if (n.lift && lifts.length && !liftedToday) {
    const l = lifts[0];
    const when = l.start != null ? `${minLabel(l.start)}${l.end != null ? `–${minLabel(l.end)}` : ''}` : '';
    if (isDue(min, n.liftAt) && (l.start == null || l.start - LEAD > min)) {
      out.push({
        key: `lift:${date}`,
        title: `Lift day: ${l.label}`,
        body: [when ? `Planned ${when}` : 'No time picked yet', l.main ? `main lift: ${l.main}` : ''].filter(Boolean).join(' · ') + '.',
        url: '/#train',
      });
    }
    if (n.liftLead && l.start != null && isDue(min, l.start - LEAD)) {
      out.push({ key: `lift-lead:${date}:${l.start}`, title: `Gym in ${LEAD} min: ${l.label}`, body: `${when}. Warm-up first, then jumps.`, url: '/#train' });
    }
  }

  // 2. Tonight's stretch.
  if (n.stretch && !stretched && isDue(min, n.stretchAt)) {
    out.push({ key: `stretch:${date}`, title: 'Tonight’s stretch', body: 'About 5 minutes, picked for what you trained. Hamstrings included.', url: '/#today' });
  }

  // 3. Weekly weigh-in.
  if (n.weigh && dow === n.weighDay && !weighedToday && isDue(min, n.weighAt)) {
    out.push({ key: `weigh:${date}`, title: 'Weigh-in day', body: 'Step on the scale before breakfast and log it.', url: '/#weigh' });
  }

  // 4. Zone 2 check-in, only when you're behind pace for the week.
  if (n.cardio && dow === n.cardioDay && isDue(min, n.cardioAt)) {
    const pace = Math.round((z2Goal * dow) / 7);
    if (z2 < pace) {
      const left = Math.max(0, z2Goal - z2);
      const daysLeft = 7 - dow;
      out.push({
        key: `cardio:${date}`,
        title: `Zone 2: ${z2} of ${z2Goal} min`,
        body: `${left} min to go${daysLeft ? ` in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : ' today'} — about ${Math.ceil(left / Math.max(1, daysLeft))} min a day.`,
        url: '/#today',
      });
    }
  }

  return out;
}
