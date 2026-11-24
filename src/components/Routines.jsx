import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings, saveSettings } from '../store.js';
import { useSessions } from '../lib/data.js';
import { todayISO } from '../lib/dates.js';
import { MUSCLES, READY_SECS } from '../lib/stretch.js';
import { PRESETS, ACTIVITIES, presetItems, routineMeta, routineSecs, buildAdaptive, logRoutine } from '../lib/routines.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../lib/toast.js';
import { Icon, Sheet } from './ui.jsx';

const clock = (secs) => {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const dur = (secs) => (secs >= 60 ? `${String(Math.round(secs / 30) / 2).replace('.5', '½')} min` : `${secs} sec`);
export const holdText = (s) => s.reps || (s.sides ? `${dur(s.secs)} each side` : dur(s.secs));
const KIND = { warm: 'Warm-up', stretch: 'Stretch' };

/* ---------- The card: build your own, or pick one ---------- */

/** Warm-ups and stretches on Today and Train. Evenings open on stretches, the rest of the day on warm-ups. */
export default function RoutinesCard({ kind: startKind = null }) {
  const [kind, setKind] = useState(startKind || (new Date().getHours() >= 17 ? 'stretch' : 'warm'));
  const [open, setOpen] = useState(null); // a preset
  const [adapt, setAdapt] = useState(false);
  const list = PRESETS.filter((p) => p.kind === kind);

  return (
    <section className="card rt-card" aria-labelledby="rt-h">
      <div className="card-head">
        <h2 id="rt-h">Warm-ups &amp; stretches</h2>
        <div className="seg rt-seg" role="group" aria-label="Kind">
          {['warm', 'stretch'].map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); haptic('tick'); }}>{KIND[k]}</button>
          ))}
        </div>
      </div>
      <AdaptButton kind={kind} onClick={() => setAdapt(true)} />
      <RoutineTiles list={list} onPick={setOpen} />
      {open && <RoutineSheet routine={{ ...open, items: presetItems(open) }} onClose={() => setOpen(null)} />}
      {adapt && <AdaptiveSheet kind={kind} onClose={() => setAdapt(false)} />}
    </section>
  );
}

function AdaptButton({ kind, onClick }) {
  return (
    <button className="rt-adapt" onClick={onClick}>
      <span className="rt-adapt-ic"><Icon name="spark" size={20} /></span>
      <span className="rt-adapt-txt">
        <b>Build my {kind === 'warm' ? 'warm-up' : 'stretch'}</b>
        <span>Rate what’s sore or tight; it still covers the essentials.</span>
      </span>
      <Icon name="right" size={18} />
    </button>
  );
}

function RoutineTiles({ list, onPick }) {
  const groups = [
    ['activity', 'For an activity'],
    ['sore', 'For sore or tight spots'],
  ];
  return groups.map(([cat, label]) => {
    const items = list.filter((p) => p.cat === cat);
    if (!items.length) return null;
    return (
      <div key={cat} className="rt-group">
        <div className="rt-label">{label}</div>
        <div className="rt-row">
          {items.map((p, i) => (
            <button key={p.id} className="rt-tile" style={{ '--hue': p.hue, '--i': i }} onClick={() => { haptic('tick'); onPick(p); }}>
              <span className="rt-tile-ic"><Icon name={p.icon} size={18} /></span>
              <b>{p.name}</b>
              <span className="rt-tile-meta">{routineMeta(presetItems(p), p.kind)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  });
}

/** Every preset of one kind in a sheet (from the workout's warm-up card or tonight's stretch). */
export function LibrarySheet({ kind, onClose, onWarmDone, prefillSore }) {
  const [open, setOpen] = useState(null);
  const [adapt, setAdapt] = useState(false);
  return (
    <Sheet title={kind === 'warm' ? 'Pick a warm-up' : 'Pick a stretch'} onClose={onClose}>
      <AdaptButton kind={kind} onClick={() => setAdapt(true)} />
      <RoutineTiles list={PRESETS.filter((p) => p.kind === kind)} onPick={setOpen} />
      {open && <RoutineSheet routine={{ ...open, items: presetItems(open) }} onClose={() => setOpen(null)} onWarmDone={onWarmDone} />}
      {adapt && <AdaptiveSheet kind={kind} prefillSore={prefillSore} onClose={() => setAdapt(false)} onWarmDone={onWarmDone} />}
    </Sheet>
  );
}

/* ---------- One routine: preview, then play ---------- */

export function RoutineSheet({ routine, onClose, onWarmDone }) {
  const [playing, setPlaying] = useState(false);
  const { kind, items, hue = '#ffcf5c' } = routine;
  return (
    <Sheet title={KIND[kind]} onClose={onClose}>
      <div className="rt-hero" style={{ '--hue': hue }}>
        <span className="rt-hero-ic"><Icon name={routine.icon || 'spark'} size={24} /></span>
        <div>
          <h3>{routine.name}</h3>
          <p>{routine.blurb}</p>
        </div>
      </div>
      <RoutineList items={items} kind={kind} />
      <button className="btn wide st-go rt-go" style={{ '--hue': hue }} onClick={() => setPlaying(true)}>
        <Icon name="play" size={18} /> Start · {Math.max(1, Math.round(routineSecs(items) / 60))} min
      </button>
      {playing && (
        <RoutinePlayer
          items={items}
          kind={kind}
          title={routine.name}
          hue={hue}
          onClose={() => { setPlaying(false); onClose(); }}
          onFinish={() => {
            const covered = logRoutine({ kind, name: routine.name, items });
            if (kind === 'warm' && onWarmDone) onWarmDone(covered);
          }}
        />
      )}
    </Sheet>
  );
}

function RoutineList({ items, kind }) {
  return (
    <ol className={`st-list rt-list${kind === 'warm' ? ' warm' : ''}`}>
      {items.map((s) => (
        <li key={s.id}>
          <span className="st-name">{s.name}{s.covers && kind === 'warm' ? <i className="rt-ess" title="Part of your program warm-up" /> : null}</span>
          <span className="st-hold">{holdText(s)}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Adaptive ---------- */

const RATE = { sore: ['—', 'Mild', 'Sore', 'Very'], tight: ['—', 'A bit', 'Tight', 'Very'] };
const LENGTHS = { warm: [5, 8, 12], stretch: [5, 10, 15] };

/** Today's soreness from the body check, if you've done one. */
function useTodaySore() {
  const sessions = useSessions();
  return useMemo(() => {
    const today = todayISO();
    const s = sessions.filter((x) => x.date === today && x.check && x.check.sore).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    return s ? { ...s.check.sore } : null;
  }, [sessions]);
}

export function AdaptiveSheet({ kind: startKind, onClose, prefillSore = null, activity: startActivity = null, onWarmDone }) {
  const s = useSettings();
  const mem = s.routineAdapt || {};
  const todaySore = useTodaySore();
  const [kind, setKind] = useState(startKind);
  const [mode, setMode] = useState('sore');
  const [sore, setSore] = useState(() => prefillSore || todaySore || {});
  const [tight, setTight] = useState(() => mem.tight || {});
  const [activity, setActivity] = useState(startActivity || mem.activity || 'lift');
  const [mins, setMins] = useState(() => (mem.mins && mem.mins[startKind]) || (startKind === 'warm' ? 8 : 10));
  const [playing, setPlaying] = useState(false);
  const fromCheck = !!(prefillSore || todaySore);

  // Tightness, activity and length carry over to next time (tightness tends to stick around; soreness is today's).
  const remember = (changes) => saveSettings({ routineAdapt: { ...mem, ...changes } });

  const plan = useMemo(() => buildAdaptive({ kind, sore, tight, mins, activity }), [kind, sore, tight, mins, activity]);
  const vals = mode === 'sore' ? sore : tight;
  const tap = (m) => {
    const v = ((Number(vals[m]) || 0) + 1) % 4;
    const next = { ...vals, [m]: v };
    if (!v) delete next[m];
    if (mode === 'sore') setSore(next);
    else {
      setTight(next);
      remember({ tight: next });
    }
    haptic('tick');
  };
  const name = kind === 'warm' ? `Your warm-up · ${ACTIVITIES.find((a) => a.id === activity)?.name.toLowerCase()}` : 'Your stretch';
  const hue = kind === 'warm' ? '#ffcf5c' : '#bba9ff';

  return (
    <Sheet title={kind === 'warm' ? 'Build my warm-up' : 'Build my stretch'} onClose={onClose}>
      <div className="seg rt-seg wide-seg" role="group" aria-label="Kind">
        {['warm', 'stretch'].map((k) => (
          <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); setMins((mem.mins && mem.mins[k]) || (k === 'warm' ? 8 : 10)); haptic('tick'); }}>{KIND[k]}</button>
        ))}
      </div>

      <div className="rt-step">
        <div className="rt-step-head">
          <b>How do you feel?</b>
          <div className="seg rt-mode" role="group" aria-label="Rating">
            <button aria-pressed={mode === 'sore'} onClick={() => setMode('sore')}>Sore</button>
            <button aria-pressed={mode === 'tight'} onClick={() => setMode('tight')}>Tight</button>
          </div>
        </div>
        <p className="muted small rt-hint">
          {mode === 'sore'
            ? fromCheck ? 'Filled in from today’s body check. Tap to change.' : 'Tap a muscle to rate it 0–3.'
            : 'Tightness is remembered for next time.'}
        </p>
        <div className={`sore-grid rt-grid mode-${mode}`}>
          {Object.entries(MUSCLES).map(([id, label]) => {
            const v = Number(vals[id]) || 0;
            const other = Number((mode === 'sore' ? tight : sore)[id]) || 0;
            return (
              <button key={id} className={`sore-chip s${v}`} onClick={() => tap(id)} aria-label={`${label}: ${mode} ${v}`}>
                <b>{label}</b>
                <span className="sore-dots" aria-hidden="true">{[1, 2, 3].map((d) => <i key={d} className={v >= d ? 'on' : ''} />)}</span>
                <span className="sore-word">
                  {v ? RATE[mode][v] : '—'}
                  {other > 0 && <em className={`rt-other ${mode === 'sore' ? 'tight' : 'sore'}`}>{mode === 'sore' ? 'tight' : 'sore'} {other}</em>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {kind === 'warm' && (
        <div className="rt-step">
          <b>Warming up for</b>
          <div className="chips">
            {ACTIVITIES.map((a) => (
              <button key={a.id} className="chip" aria-pressed={activity === a.id} onClick={() => { setActivity(a.id); remember({ activity: a.id }); haptic('tick'); }}>{a.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="rt-step">
        <b>About</b>
        <div className="chips">
          {LENGTHS[kind].map((m) => (
            <button key={m} className="chip" aria-pressed={mins === m} onClick={() => { setMins(m); remember({ mins: { ...(mem.mins || {}), [kind]: m } }); haptic('tick'); }}>{m} min</button>
          ))}
        </div>
      </div>

      <div className="rt-built" style={{ '--hue': hue }}>
        <div className="rt-built-head">
          <b>{routineMeta(plan.items, kind)}</b>
          <div className="st-focus">
            {plan.focus.length ? plan.focus.map((f) => <span key={f} className="st-tag">{f}</span>) : <span className="muted small">Nothing rated: a balanced {kind === 'warm' ? 'warm-up' : 'stretch'}</span>}
          </div>
        </div>
        {plan.notes.map((n) => <p key={n} className="adj-note">{n}</p>)}
        <RoutineList items={plan.items} kind={kind} />
        <p className="muted small rt-legend">{kind === 'warm' ? <><i className="rt-ess" /> part of your program warm-up</> : 'Hamstrings, hip flexors and low back are in every time.'}</p>
      </div>

      <button className="btn wide st-go rt-go" style={{ '--hue': hue }} onClick={() => setPlaying(true)}>
        <Icon name="play" size={18} /> Start · {Math.round(plan.secs / 60)} min
      </button>
      {playing && (
        <RoutinePlayer
          items={plan.items}
          kind={kind}
          title={name}
          hue={hue}
          onClose={() => { setPlaying(false); onClose(); }}
          onFinish={() => {
            const covered = logRoutine({ kind, name, items: plan.items });
            if (kind === 'warm' && onWarmDone) onWarmDone(covered);
          }}
        />
      )}
    </Sheet>
  );
}

/* ---------- The player ---------- */

/** The timeline: get ready, go (side 1), switch, go (side 2), next… */
function stepsOf(items, kind) {
  const out = [];
  const go = kind === 'warm' ? 'Go' : 'Hold';
  items.forEach((s, i) => {
    out.push({ kind: 'ready', s, i, secs: READY_SECS, label: i === 0 ? 'Get ready' : 'Next up' });
    if (s.sides) {
      out.push({ kind: 'hold', s, i, secs: s.secs, label: 'Side 1' });
      out.push({ kind: 'ready', s, i, secs: READY_SECS, label: 'Switch sides' });
      out.push({ kind: 'hold', s, i, secs: s.secs, label: 'Side 2' });
    } else out.push({ kind: 'hold', s, i, secs: s.secs, label: go });
  });
  return out;
}

/**
 * Plays a routine with a timer per move. `onFinish` runs once when the last move ends.
 * Used by every warm-up and stretch, tonight's included.
 */
export function RoutinePlayer({ items, kind = 'stretch', title, hue, onClose, onFinish, finishText }) {
  const steps = useMemo(() => stepsOf(items, kind), [items, kind]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(steps[0].secs);
  const [finished, setFinished] = useState(false);
  const endRef = useRef(Date.now() + steps[0].secs * 1000);
  const lastTick = useRef(null);
  const total = useMemo(() => steps.reduce((a, s) => a + s.secs, 0), [steps]);

  // Keep the screen on (iOS 16.4+; ignored where unsupported).
  useEffect(() => {
    let lock = null;
    const get = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    get();
    const vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      lock?.release().catch(() => {});
    };
  }, []);

  const go = (n) => {
    if (n >= steps.length) {
      setFinished(true);
      onFinish && onFinish();
      haptic('big');
      toast(kind === 'warm' ? 'Warmed up. Go get it.' : 'Stretch done.');
      return;
    }
    const i = Math.max(0, n);
    setAt(i);
    setLeft(steps[i].secs);
    endRef.current = Date.now() + steps[i].secs * 1000;
    lastTick.current = null;
    haptic(steps[i].kind === 'hold' ? 'success' : 'tick');
  };

  useEffect(() => {
    if (paused || finished) return undefined;
    const id = setInterval(() => {
      const rem = (endRef.current - Date.now()) / 1000;
      setLeft(rem);
      const whole = Math.ceil(rem);
      if (steps[at].kind === 'hold' && whole <= 3 && whole > 0 && lastTick.current !== whole) {
        lastTick.current = whole;
        haptic('tick');
      }
      if (rem <= 0) go(at + 1);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, paused, finished]);

  const toggle = () => {
    if (paused) endRef.current = Date.now() + left * 1000;
    setPaused(!paused);
    haptic('tick');
  };

  const style = hue ? { '--rc': hue } : undefined;
  const step = steps[at];
  const next = items[step.i + 1];
  const remaining = steps.slice(at + 1).reduce((a, s) => a + s.secs, 0) + Math.max(0, left);
  const pct = Math.min(1, Math.max(0, 1 - left / step.secs));

  if (finished) {
    return (
      <Sheet title={KIND[kind]} onClose={onClose} top>
        <div className="st-player st-finish rt-finish" style={style}>
          <Icon name={kind === 'warm' ? 'bolt' : 'moon'} size={36} />
          <h2>Done.</h2>
          <p className="muted">{finishText || `${title ? `${title}: ` : ''}${items.length} ${kind === 'warm' ? 'moves' : 'stretches'}, ${Math.round(total / 60)} minutes.`}</p>
          <button className="btn wide" onClick={onClose}>Close</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={title || KIND[kind]} onClose={onClose} top>
      <div className={`st-player rt-player${hue ? ' tinted' : ''}${step.kind === 'ready' ? ' ready' : ''}${paused ? ' paused' : ''}`} style={style}>
        <div className="st-dots" aria-label={`${step.i + 1} of ${items.length}`}>
          {items.map((s, i) => <i key={s.id} className={i < step.i ? 'done' : i === step.i ? 'on' : ''} />)}
        </div>
        <div className="eyebrow st-phase">{step.label}</div>
        <h2 className="st-title" key={`${step.i}`}>{step.s.name}</h2>
        <div className="st-targets">{Object.keys(step.s.t).slice(0, 3).map((m) => MUSCLES[m]).filter(Boolean).join(' · ')}</div>
        <div className="st-ring" style={{ '--p': pct }} role="timer" aria-live="off">
          <span className="st-time">{clock(left)}</span>
        </div>
        {step.s.reps && <div className="rt-reps">{step.s.reps}{step.s.sides ? ' per side' : ''}</div>}
        <p className="st-cue">{step.s.cue}</p>
        <div className="st-nav">
          <button className="btn ghost" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Back"><Icon name="left" size={18} /></button>
          <button className="btn" onClick={toggle}><Icon name={paused ? 'play' : 'pause'} size={18} /> {paused ? 'Resume' : 'Pause'}</button>
          <button className="btn ghost" onClick={() => go(at + 1)} aria-label="Skip"><Icon name="right" size={18} /></button>
        </div>
        <p className="muted small st-next">
          {next ? <>Next: <b>{next.name}</b> · </> : <>Last one · </>}
          {clock(remaining)} left
        </p>
      </div>
    </Sheet>
  );
}
