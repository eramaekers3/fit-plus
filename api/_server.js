// Shared setup for the notification routes in api/. fit+ shares its Supabase project (and its
// push_subscriptions table) with lifestyle+ and shoot+, so every row says which app it's for.
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const APP = 'fit';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET } = process.env;
const SUBJECT = process.env.VAPID_SUBJECT || 'https://fit-plus.vercel.app';

export const hasDb = () => !!(SUPABASE_URL && SERVER_KEY);
export const hasPushKeys = () => !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
export const publicKey = () => VAPID_PUBLIC_KEY;

/** Supabase with the server key (skips row level security, so only use it after checking who's asking). */
export const serverDb = () => createClient(SUPABASE_URL, SERVER_KEY, { auth: { persistSession: false } });

export const bearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
export const fromCron = (req) => !!CRON_SECRET && bearer(req) === CRON_SECRET;

export async function userFor(db, token) {
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return (!error && data && data.user) || null;
}

/** This app's devices with notifications on, grouped by user: Map(userId → [sub]). */
export async function subsByUser(db, userId) {
  let q = db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth, tz, updated_at').eq('app', APP).order('updated_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw new Error('Couldn’t read subscriptions. Has supabase/push.sql been run?');
  const byUser = new Map();
  for (const s of data || []) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]);
  return byUser;
}

/** Sends one notification to each device. Returns how many went through. */
export async function sendTo(db, subs, note) {
  webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({ title: note.title, body: note.body, url: note.url || '/', tag: note.tag || note.key });
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: note.ttl || 600, urgency: 'high' });
        return 1;
      } catch (e) {
        // 404/410: the phone dropped this subscription (app deleted or notifications turned off).
        if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        else console.log('push failed', e.statusCode || e.message);
        return 0;
      }
    })
  );
  return results.reduce((a, b) => a + b, 0);
}

/** Sends a note once: its key is claimed in push_log first, so a repeat tick can't send it again. */
export async function sendOnce(db, userId, subs, note) {
  const { error } = await db.from('push_log').insert({ user_id: userId, key: `${APP}:${note.key}` });
  if (error) return 0;
  return sendTo(db, subs, note);
}
