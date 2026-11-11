import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCENTS, FONTS, loadAllFonts } from '../lib/theme.js';
import { LOGO_COLORS, DEFAULT_LOGO } from '../lib/logo.js';
import { Sheet, LogoMark } from './ui.jsx';
import {
  useSettings, saveSettings, useSyncStatus, sync, signIn, signUp, signOut, clearSample, eraseAll, recentlyDeleted, putMany,
} from '../store.js';
import { toast } from '../lib/toast.js';
import { weekStart } from '../lib/dates.js';
import { settingsVersions, recentChanges, restoreVersion, settingsSummary, kindName, labelOf, exportBackup } from '../lib/history.js';

export default function SettingsSheet({ onClose }) {
  const s = useSettings();
  const st = useSyncStatus();
  const [confirmErase, setConfirmErase] = useState(false);

  return (
    <Sheet title="Settings" onClose={onClose}>
      <section className="set-sec">
        <h3>Sync</h3>
        {st.state === 'local' ? (
          <p className="muted">
            Sync isn’t set up yet, so everything saves on this device only. Add your Supabase keys to the <code>.env</code> file (or Vercel) to sync between your phone and laptop. The README walks through it.
          </p>
        ) : st.email ? (
          <>
            <p>Signed in as <b>{st.email}</b></p>
            <p className="muted small">
              {st.state === 'syncing' && 'Syncing…'}
              {st.state === 'synced' && st.lastSynced && `Synced at ${new Date(st.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              {st.state === 'offline' && 'Offline. Changes will sync when you reconnect.'}
              {st.state === 'error' && `Sync failed: ${st.error}`}
            </p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => sync()}>Sync now</button>
              <button className="btn ghost" onClick={() => signOut()}>Sign out</button>
            </div>
          </>
        ) : (
          <AuthForm />
        )}
      </section>

      <LookSection />

      <ProgramSection />

      <HistorySection signedIn={!!st.email} />

      <section className="set-sec">
        <h3>Data</h3>
        <div className="btn-row">
          {s.sample && (
            <button className="btn ghost" onClick={() => { clearSample(); toast('Sample data cleared'); }}>Clear sample data</button>
          )}
          <button
            className={`btn ${confirmErase ? 'danger' : 'ghost'}`}
            onClick={() => {
              if (!confirmErase) return setConfirmErase(true);
              eraseAll();
              setConfirmErase(false);
              toast('Everything erased');
            }}
          >
            {confirmErase ? 'Tap again to erase everything' : 'Erase all data'}
          </button>
        </div>
      </section>
    </Sheet>
  );
}

function AuthForm() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ err: true, text: e.message || 'Something went wrong. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth" onSubmit={(e) => { e.preventDefault(); run(() => signIn(email, pw)); }}>
      <p className="muted small">Sign in to sync between devices. Sample data stays behind on this device.</p>
      <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" autoComplete="current-password" placeholder="Password (6+ characters)" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
      <div className="btn-row">
        <button className="btn" disabled={busy}>Sign in</button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy || !email || pw.length < 6}
          onClick={() =>
            run(async () => {
              const needsConfirm = await signUp(email, pw);
              if (needsConfirm) setMsg({ text: 'Check your email and confirm your account, then sign in here.' });
            })
          }
        >
          Create account
        </button>
      </div>
      {msg && <p className={msg.err ? 'err' : 'muted small'}>{msg.text}</p>}
    </form>
  );
}

function LookSection() {
  const s = useSettings();
  useEffect(loadAllFonts, []);
  const current = (s.accent || '').toLowerCase();
  const isPreset = ACCENTS.some((a) => a.hex === current);
  const logo = (s.logoColor || DEFAULT_LOGO).toLowerCase();
  const logoPreset = LOGO_COLORS.some((h) => h.hex === logo);
  return (
    <section className="set-sec">
      <h3>Look</h3>
      <p className="muted small">Accent color</p>
      <div className="swatches" role="group" aria-label="Accent color">
        {ACCENTS.map((a) => (
          <button key={a.id} className="swatch" style={{ '--c': a.hex }} aria-pressed={current === a.hex} aria-label={a.name} title={a.name} onClick={() => saveSettings({ accent: a.hex })} />
        ))}
        <label className={`swatch swatch-custom${isPreset ? '' : ' on'}`} title="Pick any color">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#ffcf5c'} onChange={(e) => saveSettings({ accent: e.target.value })} aria-label="Pick any accent color" />
        </label>
      </div>

      <p className="muted small" style={{ marginTop: 14 }}>Logo and app icon</p>
      <div className="swatches" role="group" aria-label="Logo color">
        {LOGO_COLORS.map((h) => (
          <button key={h.id} className="logo-swatch" aria-pressed={logo === h.hex} aria-label={h.name} title={h.name} onClick={() => saveSettings({ logoColor: h.hex })}>
            <LogoMark color={h.hex} size={30} className="" />
          </button>
        ))}
        <label className={`swatch swatch-custom${logoPreset ? '' : ' on'}`} title="Pick any color">
          <input type="color" value={logo} onChange={(e) => saveSettings({ logoColor: e.target.value })} aria-label="Pick any logo color" />
        </label>
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>
        The logo changes right away. iPhone keeps the Home Screen icon it saved when you added the app, so to update that too, remove shoot+ from your Home Screen and add it again from Safari.
      </p>

      <p className="muted small" style={{ marginTop: 14 }}>Heading font</p>
      <div className="font-list" role="group" aria-label="Heading font">
        {FONTS.map((f) => (
          <button key={f.id} className="font-opt" aria-pressed={(s.headingFont || 'bricolage') === f.id} onClick={() => saveSettings({ headingFont: f.id })}>
            <span className="sample" style={{ fontFamily: `${f.family}, system-ui, sans-serif`, fontWeight: f.weight, letterSpacing: f.tracking }}>Week 3</span>
            <span className="fname">{f.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProgramSection() {
  const s = useSettings();
  const field = (key, label, hint, step) => (
    <label className="f">
      {label}
      <input className="input" inputMode="decimal" step={step} value={s[key] ?? ''} onChange={(e) => saveSettings({ [key]: e.target.value })} onBlur={() => saveSettings({ [key]: Number(s[key]) || 0 })} />
      {hint && <span className="f-hint">{hint}</span>}
    </label>
  );
  return (
    <section className="set-sec">
      <h3>Program & body</h3>
      <div className="form-grid">
        <label className="f full">
          Week 1 starts
          <input className="input" type="date" value={s.programStart || ''} onChange={(e) => saveSettings({ programStart: e.target.value ? weekStart(e.target.value) : '' })} />
          <span className="f-hint">Always a Monday. The 8 weeks repeat after week 8.</span>
        </label>
        {field('bodyweight', 'Body weight (lb)', 'Used until you log a weigh-in')}
        {field('proteinPerLb', 'Protein g per lb', '0.7–1; 0.8 is plenty')}
        {field('zone2Goal', 'Zone 2 min / week', 'Galpin: about 150')}
      </div>
      {(Object.keys(s.swaps || {}).length > 0 || Object.keys(s.nextWeights || {}).length > 0) && (
        <div className="btn-row">
          {Object.keys(s.swaps || {}).length > 0 && <button className="btn ghost" onClick={() => { saveSettings({ swaps: {} }); toast('Swaps cleared'); }}>Clear exercise swaps</button>}
          {Object.keys(s.nextWeights || {}).length > 0 && <button className="btn ghost" onClick={() => { saveSettings({ nextWeights: {} }); toast('Weights back to automatic'); }}>Clear set weights</button>}
        </div>
      )}
    </section>
  );
}

const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function HistorySection({ signedIn }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recentlyDeleted reads the store directly
  const deleted = useMemo(() => (open ? recentlyDeleted() : []), [open, tick]);

  useEffect(() => {
    if (!open || !signedIn) return;
    let live = true;
    setErr('');
    Promise.all([settingsVersions(), recentChanges()])
      .then(([settings, changes]) => live && setData({ settings, changes }))
      .catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [open, signedIn]);

  const restore = (key, v, msg) => {
    if (confirm !== key) return setConfirm(key);
    restoreVersion(v);
    setConfirm(null);
    setTick((t) => t + 1);
    toast(msg);
  };
  const btn = (key, v, msg) => (
    <button className={`mini${confirm === key ? ' sun' : ''}`} onClick={() => restore(key, v, msg)}>
      {confirm === key ? 'Tap to restore' : 'Restore'}
    </button>
  );

  const importFile = async (file) => {
    try {
      const body = JSON.parse(await file.text());
      const recs = (body.records || []).filter((r) => r && r.id && r.kind && r.data && !r.deleted && r.kind !== 'settings');
      if (!recs.length) throw new Error('Nothing to restore in that file.');
      putMany(recs.map((r) => [r.kind, { ...r.data, id: r.id }]));
      toast(`Restored ${recs.length} things from the backup`);
    } catch (e) {
      toast(e.message || 'That file couldn’t be read.');
    }
  };

  return (
    <section className="set-sec">
      <h3>History, backup & export</h3>
      <p className="muted small">Put back a deleted workout or an earlier version of anything, or save a backup file.</p>
      <div className="btn-row">
        <button className="btn ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide history' : 'Show history'}</button>
        <button className="btn ghost" onClick={() => exportBackup().catch((e) => toast(e.message))}>Save a backup</button>
        <button className="btn ghost" onClick={() => fileRef.current && fileRef.current.click()}>Restore a backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files[0] && importFile(e.target.files[0])} />
      </div>
      {open && (
        <div className="history">
          {signedIn && (
            <>
              <h4>Earlier settings</h4>
              {err ? (
                <p className="err">{err}</p>
              ) : !data ? (
                <p className="muted small">Loading…</p>
              ) : data.settings.length === 0 ? (
                <p className="muted small">No earlier versions yet. They’re kept from now on, for 90 days.</p>
              ) : (
                <ul className="hist-list">
                  {data.settings.map((v) => (
                    <li key={v.hid}>
                      <span><b>{when(v.updated_at)}</b><span className="muted small">{settingsSummary(v.data)}</span></span>
                      {btn(`s${v.hid}`, v, 'Settings restored')}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <h4>Recently deleted</h4>
          {deleted.length === 0 ? (
            <p className="muted small">Nothing deleted.</p>
          ) : (
            <ul className="hist-list">
              {deleted.map((r) => (
                <li key={r.id}>
                  <span><b>{labelOf(r.data)}</b><span className="muted small">{kindName(r.kind)} · deleted {when(r.updated_at)}</span></span>
                  {btn(`d${r.id}`, r, `${kindName(r.kind)} restored`)}
                </li>
              ))}
            </ul>
          )}

          {signedIn && data && data.changes.length > 0 && (
            <>
              <h4>Earlier versions</h4>
              <ul className="hist-list">
                {data.changes.map((v) => (
                  <li key={v.hid}>
                    <span><b>{labelOf(v.data)}</b><span className="muted small">{kindName(v.kind)}{v.deleted ? ' (deleted)' : ''} · as of {when(v.updated_at)}</span></span>
                    {btn(`c${v.hid}`, { ...v, deleted: false }, `${kindName(v.kind)} put back`)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
