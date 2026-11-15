// POST /api/push-timers
// Sends timers that are up (the rest timer). Called by a Supabase cron job every 5 seconds, but only
// when a fit+ timer is due (see supabase/push.sql), so it's quiet the rest of the time.
//   Header: Authorization: Bearer <CRON_SECRET>
import { APP, fromCron, hasDb, hasPushKeys, serverDb, sendTo, subsByUser } from './_server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!fromCron(req)) return res.status(401).json({ error: 'Not allowed.' });
  if (!hasDb() || !hasPushKeys()) return res.status(500).json({ error: 'The server is missing its Supabase or push keys.' });
  const db = serverDb();

  // Taking the rows out claims them, so an overlapping call can't send the same timer twice.
  const soon = new Date(Date.now() + 2000).toISOString();
  const { data: due, error } = await db.from('push_timers').delete().eq('app', APP).lte('fire_at', soon).select();
  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;
  for (const t of due || []) {
    // Long gone (the phone was offline, or the cron was paused): not worth a buzz now.
    if (Date.now() - Date.parse(t.fire_at) > 5 * 60 * 1000) continue;
    try {
      const subs = (await subsByUser(db, t.user_id)).get(t.user_id) || [];
      if (subs.length) sent += await sendTo(db, subs, { key: `${t.key}:${t.fire_at}`, tag: t.key, title: t.title, body: t.body, url: t.url, ttl: 120 });
    } catch (e) {
      console.log('timer push failed', e.message);
    }
  }
  res.status(200).json({ due: (due || []).length, sent });
}
