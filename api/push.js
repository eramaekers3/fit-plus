// GET  /api/push   → { publicKey } for turning notifications on
// POST /api/push   with Authorization: Bearer <Supabase session token>
//      → sends a test notification to every phone you've turned fit+ notifications on for.
import { bearer, hasDb, hasPushKeys, publicKey, serverDb, sendTo, subsByUser, userFor } from './_server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!hasPushKeys()) return res.status(500).json({ error: 'Notifications aren’t set up on the server yet.' });
  if (req.method === 'GET') return res.status(200).json({ publicKey: publicKey() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST.' });
  if (!hasDb()) return res.status(500).json({ error: 'The server is missing its Supabase key.' });

  const db = serverDb();
  const user = await userFor(db, bearer(req));
  if (!user) return res.status(401).json({ error: 'Sign in again, then try.' });
  try {
    const subs = (await subsByUser(db, user.id)).get(user.id) || [];
    if (!subs.length) return res.status(400).json({ error: 'No phones have fit+ notifications on yet.' });
    const sent = await sendTo(db, subs, {
      key: `test:${Date.now()}`,
      title: 'fit+ notifications are on',
      body: 'You’ll get a buzz when rest is up, plus lift-day, stretch and weekly check-ins.',
      url: '/#today',
    });
    res.status(200).json({ sent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
