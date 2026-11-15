// POST /api/push-tick
// Called once a minute by a Supabase cron job (see supabase/push.sql). Works out which fit+ reminders
// are due for each person with fit+ notifications on, and sends them.
//   Header: Authorization: Bearer <CRON_SECRET>
import { fromCron, hasDb, hasPushKeys, serverDb, sendOnce, subsByUser } from './_server.js';
import { dueNotifications, localParts, weekStartOf, addDays } from './_push-core.js';
import { DAYS, EXERCISES } from '../src/lib/program.js';

const TABLE = 'fit_records';

async function forUser(db, userId, subs, now) {
  const tz = subs[0].tz || 'America/Chicago';
  const { date } = localParts(now, tz);
  const ws = weekStartOf(date);
  const mine = (kind) => db.from(TABLE).select('data').eq('user_id', userId).eq('kind', kind).eq('deleted', false);

  const [settingsQ, planQ, sessionsQ, stretchQ, cardioQ, fitWeighQ, lsWeighQ] = await Promise.all([
    mine('settings').limit(1),
    mine('weekplan').eq('data->>ws', ws).limit(1),
    mine('session').eq('data->>date', date),
    mine('stretch').eq('data->>date', date),
    mine('cardio').gte('data->>date', ws).lte('data->>date', addDays(ws, 6)),
    mine('weigh').eq('data->>date', date),
    // Signed-in weigh-ins live in lifestyle+ (including Apple Health imports).
    db.from('records').select('data').eq('user_id', userId).eq('kind', 'weight').eq('deleted', false).eq('data->>date', date),
  ]);
  const rows = (q) => (q.data || []).map((r) => r.data || {});
  const settings = rows(settingsQ)[0] || {};
  const plan = rows(planQ)[0];
  const swaps = settings.swaps || {};

  const lifts = ((plan && plan.days && plan.days[date]) || [])
    .filter((p) => p.type === 'lift')
    .map((p) => {
      const slot = p.day && DAYS[p.day] && DAYS[p.day].slots.find((x) => x.main);
      const ex = slot && EXERCISES[swaps[slot.ex] || slot.ex];
      return { ...p, main: ex ? ex.name.toLowerCase() : '' };
    });
  const z2 = rows(cardioQ)
    .filter((c) => c.type === 'zone2' || c.type === 'walk')
    .reduce((t, c) => t + (Number(c.min) || 0), 0);

  const notes = dueNotifications({
    now,
    tz,
    notify: settings.notify,
    lifts,
    liftedToday: rows(sessionsQ).some((s) => s.status === 'done'),
    stretched: rows(stretchQ).some((s) => s.at),
    weighedToday: rows(fitWeighQ).length + rows(lsWeighQ).length > 0,
    z2,
    z2Goal: Number(settings.zone2Goal) || 150,
  });
  let sent = 0;
  for (const note of notes) sent += await sendOnce(db, userId, subs, note);
  return sent;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!fromCron(req)) return res.status(401).json({ error: 'Not allowed.' });
  if (!hasDb() || !hasPushKeys()) return res.status(500).json({ error: 'The server is missing its Supabase or push keys.' });
  const db = serverDb();
  const now = new Date();
  let byUser;
  try {
    byUser = await subsByUser(db);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  let sent = 0;
  for (const [userId, list] of byUser) {
    try {
      sent += await forUser(db, userId, list, now);
    } catch (e) {
      console.log('fit push tick failed for a user', e.message);
    }
  }
  res.status(200).json({ users: byUser.size, sent });
}
