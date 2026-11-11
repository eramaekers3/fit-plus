import { useState } from 'react';
import { useSettings, put } from '../store.js';
import { useWeighs, logProtein, logWeight, logCardio, saveMeal, removeMeal, useVerts } from '../lib/data.js';
import { latestWeight } from '../lib/engine.js';
import { CARDIO_TYPES } from '../lib/program.js';
import { todayISO, addDays } from '../lib/dates.js';
import { newId } from '../lib/ids.js';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';
import { toast } from '../lib/toast.js';
import { Sheet, Icon } from './ui.jsx';

const TABS = [
  { id: 'protein', label: 'Protein' },
  { id: 'weight', label: 'Weight' },
  { id: 'cardio', label: 'Cardio' },
];

/** The + button: log protein, a weigh-in or cardio in a couple of taps. */
export default function QuickLog({ tab: first = 'protein', onClose }) {
  const [tab, setTab] = useState(first);
  return (
    <Sheet title="Log" onClose={onClose}>
      <div className="seg wide-seg" role="group" aria-label="What to log">
        {TABS.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="subview swap" key={tab}>
        {tab === 'protein' && <Protein onClose={onClose} />}
        {tab === 'weight' && <Weight onClose={onClose} />}
        {tab === 'cardio' && <Cardio onClose={onClose} />}
      </div>
    </Sheet>
  );
}

function DayPick({ date, setDate }) {
  const today = todayISO();
  return (
    <div className="seg day-pick" role="group" aria-label="Day">
      <button aria-pressed={date === today} onClick={() => setDate(today)}>Today</button>
      <button aria-pressed={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>Yesterday</button>
    </div>
  );
}

function Protein({ onClose }) {
  const s = useSettings();
  const [g, setG] = useState('');
  const [label, setLabel] = useState('');
  const [keep, setKeep] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [manage, setManage] = useState(false);
  const add = (e) => {
    e.preventDefault();
    const n = Number(g);
    if (!n) return;
    logProtein(n, label, date);
    if (keep && label.trim()) saveMeal(label, n);
    haptic('success');
    cheer(e.currentTarget, { text: `+${n} g` });
    toast(keep && label.trim() ? `Logged and saved “${label.trim()}”` : `Logged ${n} g`);
    onClose();
  };
  return (
    <>
      <div className="sub-head">
        <h3 className="sub-h">Saved meals</h3>
        {(s.meals || []).length > 0 && <button className="mini" onClick={() => setManage(!manage)}>{manage ? 'Done' : 'Edit'}</button>}
      </div>
      <div className="chips meal-chips">
        {(s.meals || []).map((m) =>
          manage ? (
            <span key={m.id} className="chip">{m.name} {m.g}g<button className="x" aria-label={`Remove ${m.name}`} onClick={() => removeMeal(m.id)}>×</button></span>
          ) : (
            <button key={m.id} className="chip" onClick={(e) => { logProtein(m.g, m.name, date); haptic('success'); cheer(e.currentTarget, { text: `+${m.g} g` }); toast(`${m.name}: +${m.g} g`); }}>
              {m.name} <span className="muted">{m.g}g</span>
            </button>
          )
        )}
        {!(s.meals || []).length && <p className="muted small">Save your usual campus orders here for one-tap logging.</p>}
      </div>
      <h3 className="sub-h">Something else</h3>
      <form className="log-form" onSubmit={add}>
        <div className="form-grid">
          <label className="f">Grams<input className="input" inputMode="numeric" placeholder="30" value={g} onChange={(e) => setG(e.target.value.replace(/\D/g, ''))} autoFocus /></label>
          <label className="f">What<input className="input" placeholder="Chicken bowl" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {[10, 20, 25, 30, 40, 50].map((n) => <button type="button" key={n} className="chip" aria-pressed={Number(g) === n} onClick={() => setG(String(n))}>{n} g</button>)}
        </div>
        <label className="toggle"><span>Save as a meal for one-tap logging</span><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /></label>
        <DayPick date={date} setDate={setDate} />
        <button className="btn wide" disabled={!Number(g)}>Log {g ? `${g} g` : 'protein'}</button>
      </form>
    </>
  );
}

function Weight({ onClose }) {
  const s = useSettings();
  const weighs = useWeighs();
  const [date, setDate] = useState(todayISO());
  const existing = weighs.find((w) => w.date === date);
  const [lb, setLb] = useState(String(existing ? existing.lb : latestWeight(weighs, s) || ''));
  const n = Number(lb);
  return (
    <form className="log-form" onSubmit={(e) => {
      e.preventDefault();
      if (!n) return;
      logWeight(n, date);
      haptic('success');
      toast(`${n} lb logged`);
      onClose();
    }}>
      <div className="weight-row big-weight">
        <button type="button" className="icon-btn" aria-label="0.2 lb less" onClick={() => setLb((Math.round((n - 0.2) * 10) / 10).toString())}><Icon name="minus" /></button>
        <label className="weight-box">
          <input className="weight-in" inputMode="decimal" value={lb} onChange={(e) => setLb(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Weight in pounds" />
          <span>lb</span>
        </label>
        <button type="button" className="icon-btn" aria-label="0.2 lb more" onClick={() => setLb((Math.round((n + 0.2) * 10) / 10).toString())}><Icon name="plus" /></button>
      </div>
      <p className="muted small center-text">Morning, after the bathroom, before eating.</p>
      <DayPick date={date} setDate={setDate} />
      <button className="btn wide" disabled={!n}>{existing ? 'Update' : 'Log'} weigh-in</button>
    </form>
  );
}

function Cardio({ onClose }) {
  const [type, setType] = useState('zone2');
  const [min, setMin] = useState('30');
  const [date, setDate] = useState(todayISO());
  return (
    <form className="log-form" onSubmit={(e) => {
      e.preventDefault();
      logCardio(type, min, date);
      haptic('success');
      cheer(e.currentTarget, { text: `${min} min` });
      toast('Cardio logged');
      onClose();
    }}>
      <div className="type-grid">
        {CARDIO_TYPES.map((t) => (
          <button type="button" key={t.id} className={`type-opt c-${t.id}`} aria-pressed={type === t.id} onClick={() => setType(t.id)}>
            <b>{t.name}</b><span>{t.hint}</span>
          </button>
        ))}
      </div>
      <h3 className="sub-h">Minutes</h3>
      <div className="chips">
        {[20, 30, 45, 60, 90].map((n) => <button type="button" key={n} className="chip" aria-pressed={Number(min) === n} onClick={() => setMin(String(n))}>{n}</button>)}
        <input className="input num-in mini-in" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label="Minutes" />
      </div>
      <DayPick date={date} setDate={setDate} />
      <button className="btn wide" disabled={!Number(min)}>Log {min} min</button>
    </form>
  );
}

/** A vertical jump test: standing reach, then the best of 3 touches. */
export function VertSheet({ onClose }) {
  const verts = useVerts();
  const last = [...verts].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [reach, setReach] = useState(last ? String(last.reach) : '');
  const [jumps, setJumps] = useState(['', '', '']);
  const best = Math.max(0, ...jumps.map(Number));
  const vertical = reach && best ? Math.round((best - Number(reach)) * 10) / 10 : null;
  return (
    <Sheet title="Vertical test" onClose={onClose}>
      <p className="sheet-sub">Stand side-on to a wall, reach up flat-footed and mark it. Then jump and touch as high as you can, three times, full rest between. Video it.</p>
      <form className="log-form" onSubmit={(e) => {
        e.preventDefault();
        if (vertical == null) return;
        put('vert', { id: newId(), date: todayISO(), reach: Number(reach), jumps: jumps.map(Number).filter(Boolean), best, vertical });
        haptic('big');
        cheer(e.currentTarget, { text: `${vertical}″`, sub: 'vertical' });
        toast(`Vertical: ${vertical} in`);
        onClose();
      }}>
        <label className="f">Standing reach (inches)<input className="input" inputMode="decimal" placeholder="e.g. 108" value={reach} onChange={(e) => setReach(e.target.value.replace(/[^\d.]/g, ''))} /></label>
        <div className="form-grid three" style={{ marginTop: 12 }}>
          {jumps.map((j, i) => (
            <label key={i} className="f">Jump {i + 1}<input className="input" inputMode="decimal" placeholder="touch" value={j} onChange={(e) => setJumps(jumps.map((x, k) => (k === i ? e.target.value.replace(/[^\d.]/g, '') : x)))} /></label>
          ))}
        </div>
        <p className="vert-result">{vertical != null ? <>Vertical: <b>{vertical}″</b></> : 'Enter your reach and at least one touch.'}</p>
        <button className="btn wide" disabled={vertical == null}>Save test</button>
      </form>
    </Sheet>
  );
}
