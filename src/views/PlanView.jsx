import { useMemo, useState } from 'react';
import { useSettings, saveSettings } from '../store.js';
import { useSessions } from '../lib/data.js';
import { prescribe, weekInfo, historyOf, e1rm } from '../lib/engine.js';
import { DAYS, DAY_IDS, PHASES, WARMUP, BACK_RULES, ALTERNATIVES, EXERCISES, dayLabel, exName, muscleName } from '../lib/program.js';
import { todayISO, fmt, addDays, weekStart } from '../lib/dates.js';
import { openExercise } from '../lib/open.js';
import { rx } from './TrainView.jsx';
import { StartCard } from './TodayView.jsx';
import { Icon, Sheet } from '../components/ui.jsx';
import CardStack from '../components/CardStack.jsx';
import { toast } from '../lib/toast.js';

export default function PlanView() {
  const s = useSettings();
  const today = todayISO();
  const wk = weekInfo(today, s.programStart);
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">The plan</div>
        <h1>8-week Galpin</h1>
        <p>Three full-body lifts a week: jumps first while you’re fresh, then one heavy lift, then hypertrophy work. Zone 2 and basketball between.</p>
      </header>
      {!s.programStart && <StartCard />}
      <CardStack
        page="plan"
        cards={[
          { id: 'weeks', title: 'The 8 weeks', node: <Weeks wk={wk} /> },
          ...DAY_IDS.map((d) => ({ id: d, title: dayLabel(d), node: <DayCard day={d} /> })),
          { id: 'warm', title: 'Warm-up', node: <Warm /> },
          { id: 'rules', title: 'How it adjusts', node: <Rules /> },
          { id: 'back', title: 'Back rules', node: <BackRules /> },
        ]}
      />
    </>
  );
}

function Weeks({ wk }) {
  const s = useSettings();
  const [editing, setEditing] = useState(false);
  return (
    <section className="card">
      <div className="card-head">
        <h2>The 8 weeks</h2>
        {s.programStart && <button className="mini" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Start date'}</button>}
      </div>
      {editing && (
        <div className="inline" style={{ marginBottom: 10 }}>
          <input className="input" type="date" value={s.programStart} onChange={(e) => e.target.value && saveSettings({ programStart: weekStart(e.target.value) })} />
          <button className="btn ghost" onClick={() => { saveSettings({ programStart: '' }); setEditing(false); }}>Clear</button>
        </div>
      )}
      <ol className="week-list">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((w) => {
          const p = PHASES[w];
          const start = s.programStart ? addDays(s.programStart, (w - 1) * 7 + (wk.block > 1 ? (wk.block - 1) * 56 : 0)) : null;
          return (
            <li key={w} className={`wk-row${wk.week === w ? ' now' : ''}${p.deload ? ' dl' : ''}${wk.week != null && w < wk.week ? ' past' : ''}`}>
              <span className="wk-n">{w}</span>
              <span className="row-title">
                <b>{p.name}</b>
                <span className="muted small">{p.note}</span>
              </span>
              {start && w > 0 && <span className="meta">{fmt(start, { month: 'short', day: 'numeric' })}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DayCard({ day }) {
  const s = useSettings();
  const sessions = useSessions();
  const today = todayISO();
  const plan = useMemo(() => prescribe({ day, date: today, sessions, settings: s }), [day, today, sessions, s]);
  return (
    <section className="card">
      <div className="card-head"><h2>{dayLabel(day)} · {DAYS[day].short}</h2><span className="meta">next time</span></div>
      <p className="card-sub">{DAYS[day].name}</p>
      <ul className="rows">
        {plan.items.map((it) => (
          <li key={it.key} className="row">
            {it.ss ? <span className="ss-tag">{it.ss}</span> : <span className="ss-tag blank" />}
            <button className="task-open row-title hist-open" onClick={() => openExercise(it.ex)}>
              <b>{it.name}</b>
              <span className="muted small">{rx(it)} · rest {Math.round(it.rest / 60 * 10) / 10} min{s.swaps && s.swaps[it.slot] ? ' · swapped' : ''}</span>
            </button>
            <Icon name="right" size={16} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Warm() {
  return (
    <section className="card">
      <div className="card-head"><h2>Warm-up</h2><span className="meta">every lift day · ~10 min</span></div>
      <p className="card-sub">The McGill “big 3” switch on the muscles that brace your spine before you load it.</p>
      <ol className="steps">
        {WARMUP.map((w) => <li key={w.id}><b>{w.text}</b> — {w.detail}</li>)}
      </ol>
    </section>
  );
}

function Rules() {
  return (
    <section className="card">
      <div className="card-head"><h2>How it adjusts</h2></div>
      <ul className="rule-list">
        <li><b>Main lifts:</b> every rep with 2+ in the tank → +5 lb next week. Missed reps or hit failure → same weight. Missed reps on 2+ sets → 5% lighter. Weeks 5–7 switch to 5 × 3, worked out from your estimated max.</li>
        <li><b>Hypertrophy:</b> top of the rep range on every set → add weight (5 lb dumbbells, 10 lb machines) and start back at the bottom. Otherwise same weight, one more rep.</li>
        <li><b>Deloads (weeks 4 and 8):</b> half the sets, same weights, jumps 2 × 3.</li>
        <li><b>Soreness 2 (sore):</b> one set fewer; main lifts aim for 3 in the tank. <b>3 (very sore):</b> hypertrophy for that muscle is skipped; main lift 10% lighter.</li>
        <li><b>Sore legs or basketball yesterday:</b> half the jump sets.</li>
        <li><b>Sore low back:</b> front squat becomes split squats, trap bar 15% lighter.</li>
        <li><b>Back over 3/10 last session:</b> lower-body main lift 10% lighter next time.</li>
        <li><b>Under 6 hours of sleep:</b> it offers the minimum session (jumps + main lift).</li>
        <li><b>Soreness never holds back progress:</b> next week’s weights come from what you actually lifted.</li>
      </ul>
    </section>
  );
}

function BackRules() {
  return (
    <section className="card">
      <div className="card-head"><h2>Back rules</h2></div>
      <ul className="rule-list">
        {BACK_RULES.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </section>
  );
}

/* ---------- One exercise: swap it, set its next weight, see its history ---------- */

export function ExerciseSheet({ exId, onClose }) {
  const s = useSettings();
  const sessions = useSessions();
  const ex = EXERCISES[exId];
  // Which program slot this exercise fills (itself, or the one it stands in for).
  const slot = Object.keys(ALTERNATIVES).find((k) => k === exId || (s.swaps || {})[k] === exId) || exId;
  const options = [slot, ...(ALTERNATIVES[slot] || [])];
  const hist = useMemo(() => historyOf(sessions, exId).slice(0, 6), [sessions, exId]);
  const override = (s.nextWeights || {})[exId];
  const [w, setW] = useState(override ?? '');
  if (!ex) return null;

  const setSwap = (id) => {
    const swaps = { ...(s.swaps || {}) };
    if (id === slot) delete swaps[slot];
    else swaps[slot] = id;
    saveSettings({ swaps });
    toast(id === slot ? `Back to ${exName(slot)}` : `${exName(slot)} → ${exName(id)}`);
    onClose();
  };
  const saveW = () => {
    const nw = { ...(s.nextWeights || {}) };
    if (w === '' || w == null) delete nw[exId];
    else nw[exId] = Number(w);
    saveSettings({ nextWeights: nw });
    toast(w === '' ? 'Back to automatic' : `Next time: ${w} lb`);
  };

  return (
    <Sheet title={ex.name} onClose={onClose}>
      <p className="sheet-sub">
        {ex.kind === 'main' ? 'Main lift' : ex.kind === 'jump' ? 'Power' : 'Hypertrophy'} · {ex.muscles.map(muscleName).join(', ')}
        {ex.also ? ` (+ ${ex.also.map(muscleName).join(', ').toLowerCase()})` : ''}
      </p>
      {ex.cue && <p className="ex-cue">{ex.cue}</p>}

      {options.length > 1 && (
        <>
          <h3 className="sub-h">Use</h3>
          <div className="chips">
            {options.map((id) => (
              <button key={id} className="chip" aria-pressed={((s.swaps || {})[slot] || slot) === id} onClick={() => setSwap(id)}>
                <Icon name="swap" size={14} /> {exName(id)}
              </button>
            ))}
          </div>
        </>
      )}

      {ex.kind !== 'jump' && (
        <>
          <h3 className="sub-h">Next weight</h3>
          <p className="muted small">Worked out from your last session. Set one here to override it once (a starting weight, or after a break).</p>
          <form className="inline" onSubmit={(e) => { e.preventDefault(); saveW(); }}>
            <input className="input num-in" inputMode="decimal" placeholder="lb" value={w} onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ''))} />
            <button className="btn">{w === '' ? 'Use automatic' : 'Set'}</button>
          </form>
        </>
      )}

      <h3 className="sub-h">Recent</h3>
      {hist.length === 0 ? (
        <p className="empty">Not done yet.</p>
      ) : (
        <ul className="rows">
          {hist.map((h) => {
            const best = Math.max(0, ...h.item.log.map((l) => e1rm(Number(l.w) || 0, l.reps, l.rir)));
            return (
              <li key={h.session.id + h.item.key} className="row">
                <span className="row-title">
                  <b>{fmt(h.date, { month: 'short', day: 'numeric' })}{h.deload ? ' · deload' : ''}</b>
                  <span className="muted small">{h.item.log.map((l) => (ex.kind === 'jump' ? `${l.reps}${l.h ? `@${l.h}″` : ''}` : `${l.w}×${l.reps}${l.rir != null ? ` (${l.rir})` : ''}`)).join(', ')}</span>
                </span>
                {best > 0 && !ex.bw && !ex.assist && <span className="meta">~{Math.round(best)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
