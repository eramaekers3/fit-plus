import { useMemo, useState } from 'react';
import { put, patch, remove, useSettings, saveSettings } from '../store.js';
import { useSessions, useCardio, useOpenSession } from '../lib/data.js';
import { prescribe, weekInfo, nextDay, prsIn } from '../lib/engine.js';
import { DAYS, DAY_IDS, MUSCLES, WARMUP, dayLabel, exName } from '../lib/program.js';
import { todayISO, addDays, fmt } from '../lib/dates.js';
import { newId } from '../lib/ids.js';
import { startRest, stopRest } from '../lib/rest.js';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';
import { toast } from '../lib/toast.js';
import { open } from '../lib/open.js';
import { Icon, Sheet } from '../components/ui.jsx';
import { StartCard } from './TodayView.jsx';

export default function TrainView() {
  const open = useOpenSession();
  if (open && open.status === 'check') return <BodyCheck session={open} />;
  if (open) return <Workout session={open} />;
  return <Picker />;
}

/* ---------- Choosing a day ---------- */

export function startSession(day, sessions, cardio) {
  const date = todayISO();
  const yesterday = addDays(date, -1);
  const bball = cardio.some((c) => c.date === yesterday && c.type === 'bball');
  // Carry over last time's ratings as a starting point? No: soreness is today's, so start at zero.
  const s = put('session', {
    id: newId(),
    day,
    date,
    status: 'check',
    check: { sore: {}, bball, sleep: '' },
    minimal: false,
    items: [],
    warm: {},
    createdAt: new Date().toISOString(),
  });
  haptic('tick');
  return s;
}

function Picker() {
  const s = useSettings();
  const sessions = useSessions();
  const cardio = useCardio();
  const today = todayISO();
  const wk = weekInfo(today, s.programStart);
  const nd = useMemo(() => nextDay(sessions, today), [sessions, today]);
  const [pick, setPick] = useState(null);
  const day = pick || nd.next || 'd1';
  const preview = useMemo(() => prescribe({ day, date: today, sessions, settings: s }), [day, today, sessions, s]);

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{wk.week == null ? 'Train' : wk.week === 0 ? 'Week 0 · Baseline' : `Week ${wk.week} · ${wk.phase.name}`}</div>
        <h1>{nd.next ? `${dayLabel(day)}` : pick ? dayLabel(day) : 'Lifts done'}</h1>
        <p>{nd.next || pick ? DAYS[day].name : 'All three lift days are done this week. Zone 2 or basketball today.'}</p>
      </header>

      {!s.programStart && <StartCard />}

      {nd.liftedToday && <p className="banner">You already lifted today. Another session would cut into recovery.</p>}
      {!nd.liftedToday && nd.liftedYesterday && (
        <p className="banner">You lifted yesterday. Keep a day between lifts if you can — today is a good zone 2 day.</p>
      )}

      <div className="seg day-seg" role="group" aria-label="Lift day">
        {DAY_IDS.map((d) => (
          <button key={d} aria-pressed={day === d} onClick={() => setPick(d)}>
            {dayLabel(d)}{nd.doneThisWeek.has(d) ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{DAYS[day].short}</h2>
          <span className="meta">~60 min</span>
        </div>
        <ul className="rows preview-rows">
          {preview.items.map((it) => (
            <li key={it.key} className="row">
              {it.ss ? <span className="ss-tag">{it.ss}</span> : <span className="ss-tag blank" />}
              <span className="row-title">{it.name}</span>
              <span className="meta">{rx(it)}</span>
            </li>
          ))}
        </ul>
        {preview.notes.filter((n) => n.kind === 'week').map((n) => <p key={n.text} className="muted small">{n.text}</p>)}
        <button className="btn wide big-btn" onClick={() => startSession(day, sessions, cardio)}>
          Start {dayLabel(day)}
        </button>
        <p className="muted small center-text">First you’ll rate soreness, sleep and basketball. The workout adjusts to it.</p>
      </section>
    </>
  );
}

/** "4 × 5 · 225 lb" */
export function rx(it) {
  const reps = it.kind === 'acc' && it.lo !== it.hi ? `${it.reps}` : `${it.lo}`;
  const unit = it.unit === 'm' ? ' m' : '';
  const side = it.perSide ? '/side' : '';
  const w = it.kind === 'jump' ? '' : it.bw ? (it.w ? ` · +${it.w} lb` : ' · bodyweight') : it.assist ? (it.w != null ? ` · ${it.w} lb help` : ' · pick help') : it.w != null ? ` · ${it.w} lb` : ' · pick weight';
  return `${it.sets} × ${reps}${unit}${side}${w}`;
}

/* ---------- Body check ---------- */

const SORE = ['None', 'Mild', 'Sore', 'Very sore'];

function BodyCheck({ session }) {
  const s = useSettings();
  const sessions = useSessions();
  const check = useMemo(() => session.check || { sore: {} }, [session.check]);
  const set = (changes) => patch(session.id, { check: { ...check, ...changes } });
  const setMinimal = (v) => patch(session.id, { minimal: v });
  const plan = useMemo(
    () => prescribe({ day: session.day, date: session.date, sessions, settings: s, check, minimal: session.minimal }),
    [session.day, session.date, session.minimal, sessions, s, check]
  );
  const changed = plan.items.filter((it) => it.why.some((w) => !w.startsWith('+') && !w.startsWith('Same') && !w.startsWith('New') && !w.startsWith('Weight set') && !w.startsWith('First') && !w.startsWith('Missed')) || it.skipped);

  const go = () => {
    patch(session.id, {
      status: 'active',
      week: plan.week,
      block: plan.block,
      deload: plan.deload,
      notes: plan.notes.map((n) => n.text),
      items: plan.items,
      startedAt: new Date().toISOString(),
    });
    haptic('success');
    window.scrollTo(0, 0);
  };

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{dayLabel(session.day)} · body check</div>
        <h1>How do you feel?</h1>
        <p>Tap a muscle to rate it. Soreness changes today’s sets, not your progression.</p>
      </header>

      <section className="card">
        <div className="card-head"><h2>Soreness</h2><span className="meta">tap to cycle 0–3</span></div>
        <div className="sore-grid">
          {MUSCLES.map((m) => {
            const v = Number(check.sore[m.id]) || 0;
            return (
              <button
                key={m.id}
                className={`sore-chip s${v}`}
                onClick={() => set({ sore: { ...check.sore, [m.id]: (v + 1) % 4 } })}
                aria-label={`${m.name}: ${SORE[v]}`}
              >
                <b>{m.name}</b>
                <span className="sore-dots" aria-hidden="true">{[1, 2, 3].map((d) => <i key={d} className={v >= d ? 'on' : ''} />)}</span>
                <span className="sore-word">{SORE[v]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Recovery</h2></div>
        <label className="toggle">
          <span><Icon name="ball" size={16} /> Played basketball yesterday</span>
          <input type="checkbox" checked={!!check.bball} onChange={(e) => set({ bball: e.target.checked })} />
        </label>
        <div className="toggle sleep-row">
          <span><Icon name="moon" size={16} /> Sleep last night</span>
          <div className="chips">
            {[5, 6, 7, 8, 9].map((h) => (
              <button key={h} className="chip" aria-pressed={Number(check.sleep) === h} onClick={() => set({ sleep: Number(check.sleep) === h ? '' : h })}>
                {h === 5 ? '≤5' : h === 9 ? '9+' : h} h
              </button>
            ))}
          </div>
        </div>
        <label className="toggle">
          <span><Icon name="clock" size={16} /> Minimum session <span className="muted small">— jumps and the main lift only</span></span>
          <input type="checkbox" checked={!!session.minimal} onChange={(e) => setMinimal(e.target.checked)} />
        </label>
      </section>

      <section className="card adjust-card">
        <div className="card-head"><h2>Today’s changes</h2><span className="meta">{plan.week != null ? `Week ${plan.week}` : ''}</span></div>
        {plan.notes.length === 0 && changed.length === 0 ? (
          <p className="muted">Nothing to change. The workout runs as planned.</p>
        ) : (
          <>
            {plan.notes.map((n) => (
              <p key={n.text} className={`adj-note k-${n.kind}`}>
                {n.text}
                {n.offerMinimal && <button className="mini sun" onClick={() => setMinimal(true)}>Use it</button>}
              </p>
            ))}
            <ul className="rows">
              {changed.map((it) => (
                <li key={it.key} className="row adj-row">
                  <span className="row-title"><b>{it.name}</b><span className="muted small">{it.skipped ? `Skipped · ${it.skipped}` : it.why.filter((w) => !w.startsWith('+')).join(' · ')}</span></span>
                  <span className="meta">{it.skipped ? '—' : rx(it)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="btn-row stack-row">
        <button className="btn big-btn" onClick={go}>Start lifting</button>
        <button className="btn ghost" onClick={() => remove(session.id)}>Cancel</button>
      </div>
    </>
  );
}

/* ---------- The workout ---------- */

function Workout({ session }) {
  const [finishing, setFinishing] = useState(false);
  const [warmOpen, setWarmOpen] = useState(() => !Object.keys(session.warm || {}).length);
  const items = session.items || [];
  const doneSets = items.reduce((t, it) => t + (it.log || []).length, 0);
  const totalSets = items.filter((it) => !it.skipped).reduce((t, it) => t + it.sets, 0);
  const warm = session.warm || {};
  const warmDone = WARMUP.filter((w) => warm[w.id]).length;

  const updItem = (key, fn) => patch(session.id, { items: (session.items || []).map((it) => (it.key === key ? fn(it) : it)) });

  return (
    <>
      <header className="dayhead">
        <div>
          <div className="eyebrow">{session.week === 0 ? 'Week 0' : session.week ? `Week ${session.week}` : ''}{session.deload ? ' · deload' : ''}{session.minimal ? ' · minimum' : ''}</div>
          <h1>
            {dayLabel(session.day)}
            <span>{DAYS[session.day].name}</span>
          </h1>
        </div>
        <div className="set-count">
          <b>{doneSets}<small>/{totalSets}</small></b>
          <span>sets</span>
        </div>
      </header>
      <div className="progress-line" aria-hidden="true"><i style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>

      {(session.notes || []).length > 0 && (
        <section className="card adjust-card compact">
          {(session.notes || []).map((t) => <p key={t} className="adj-note">{t}</p>)}
        </section>
      )}

      <section className={`card warm-card${warmOpen ? '' : ' shut'}`}>
        <div className="card-head" onClick={() => setWarmOpen(!warmOpen)} role="button" tabIndex={0}>
          <h2>Warm-up</h2>
          <span className="meta">{warmDone === WARMUP.length ? 'Done ✓' : `${warmDone}/${WARMUP.length} · ~10 min`}</span>
        </div>
        {warmOpen && (
          <ul className="rows">
            {WARMUP.map((w) => (
              <li key={w.id} className="row">
                <button
                  className={`check${warm[w.id] ? ' on' : ''}`}
                  aria-label={`${w.text} done`}
                  onClick={() => {
                    const next = { ...warm, [w.id]: !warm[w.id] };
                    patch(session.id, { warm: next });
                    if (WARMUP.every((x) => next[x.id])) {
                      haptic('success');
                      setWarmOpen(false);
                    }
                  }}
                >
                  {warm[w.id] && <Icon name="check" size={16} />}
                </button>
                <span className="row-title">{w.text}</span>
                <span className="meta">{w.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {items.map((it) => (
        <ExerciseCard key={it.key} it={it} session={session} updItem={updItem} />
      ))}

      <button className="btn wide big-btn" onClick={() => setFinishing(true)}>
        {doneSets >= totalSets ? 'Finish workout' : `Finish early (${doneSets}/${totalSets} sets)`}
      </button>
      <button className="link-btn center-link" onClick={() => {
        if (doneSets && !window.confirm('Throw away this workout and its sets?')) return;
        stopRest();
        remove(session.id);
      }}>Discard workout</button>

      {finishing && <FinishSheet session={session} onClose={() => setFinishing(false)} />}
    </>
  );
}

/** What comes after logging this set, for the rest timer. */
function nextUp(session, it, setIdx) {
  const items = session.items.filter((x) => !x.skipped);
  if (it.ss) {
    const pair = items.filter((x) => x.ss === it.ss);
    const other = pair.find((x) => x.key !== it.key);
    if (other && (other.log || []).length <= setIdx && (other.log || []).length < other.sets) return `${other.name}, set ${(other.log || []).length + 1}`;
  }
  if (setIdx + 1 < it.sets) return `${it.name}, set ${setIdx + 2}`;
  const after = items.slice(items.findIndex((x) => x.key === it.key) + 1).find((x) => (x.log || []).length < x.sets);
  return after ? after.name : 'Finish up';
}

function ExerciseCard({ it, session, updItem }) {
  const log = it.log || [];
  const doneAll = log.length >= it.sets;
  const [editing, setEditing] = useState(null); // index of a logged set being changed
  const [reps, setReps] = useState(null);
  const [h, setH] = useState('');
  const curReps = reps ?? it.reps;
  const isMain = it.kind === 'main';

  const setW = (w) => updItem(it.key, (x) => ({ ...x, w: Math.max(0, w) }));

  const logSet = (rir, el) => {
    const idx = log.length;
    const entry = it.kind === 'jump' ? { reps: it.reps, h: h ? Number(h) : null } : { w: it.w ?? 0, reps: curReps, rir };
    updItem(it.key, (x) => ({ ...x, log: [...(x.log || []), { ...entry, at: new Date().toISOString() }] }));
    setReps(null);
    setH('');
    const finished = idx + 1 >= it.sets;
    if (finished) {
      haptic('success');
      cheer(el, { text: 'Done', sub: it.name });
    }
    startRest(it.rest, it.name, nextUp(session, it, idx));
  };

  const fixSet = (i, changes) => updItem(it.key, (x) => ({ ...x, log: x.log.map((l, j) => (j === i ? { ...l, ...changes } : l)) }));
  const dropSet = (i) => {
    updItem(it.key, (x) => ({ ...x, log: x.log.filter((_, j) => j !== i) }));
    setEditing(null);
  };

  if (it.skipped) {
    return (
      <section className="card ex-card skipped">
        <div className="card-head">
          <h3 className="ex-name">{it.name}</h3>
          <span className="meta">Skipped · {it.skipped}</span>
        </div>
        <button className="mini" onClick={() => updItem(it.key, (x) => ({ ...x, skipped: null }))}>Do it anyway</button>
      </section>
    );
  }

  return (
    <section className={`card ex-card k-${it.kind}${doneAll ? ' all-done' : ''}`}>
      <div className="ex-head">
        <div className="ex-title">
          {it.ss && <span className="ss-tag">{it.ss}</span>}
          <h3 className="ex-name">{it.name}</h3>
        </div>
        <span className="meta">{doneAll ? 'Done ✓' : `rest ${Math.floor(it.rest / 60)}:${String(it.rest % 60).padStart(2, '0')}`}</span>
      </div>
      <p className="ex-rx">
        <b>{it.sets} × {it.kind === 'acc' && it.lo !== it.hi ? `${it.lo}–${it.hi}` : it.lo}{it.unit === 'm' ? ' m' : ''}{it.perSide ? ' per side' : ''}</b>
        {it.kind === 'acc' && it.lo !== it.hi && <span> · aim for {it.reps}</span>}
        {it.rir != null && <span> · {it.rir === 1 ? '1–2' : it.rir === 2 ? '2–3' : it.rir} in the tank</span>}
      </p>
      {it.why.length > 0 && <p className="ex-why">{it.why.join(' · ')}</p>}
      {it.cue && <p className="ex-cue">{it.cue}</p>}

      {it.kind !== 'jump' && !doneAll && (
        <div className="weight-row">
          <button className="icon-btn" aria-label={`${it.inc} lb lighter`} onClick={() => setW((it.w ?? 0) - it.inc)}><Icon name="minus" /></button>
          <label className="weight-box">
            <input
              className="weight-in"
              inputMode="decimal"
              value={it.w ?? ''}
              placeholder={it.bw ? '0' : 'lb'}
              onChange={(e) => updItem(it.key, (x) => ({ ...x, w: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, '')) }))}
              aria-label="Weight in pounds"
            />
            <span>{it.bw ? 'lb added' : it.assist ? 'lb help' : 'lb'}{it.perSide && !it.bw ? ' each' : ''}</span>
          </label>
          <button className="icon-btn" aria-label={`${it.inc} lb heavier`} onClick={() => setW((it.w ?? 0) + it.inc)}><Icon name="plus" /></button>
        </div>
      )}
      {it.kind === 'jump' && it.lastBest ? <p className="muted small">Best so far: {it.lastBest} in</p> : null}

      <ol className="sets">
        {log.map((l, i) => (
          <li key={i} className="set done-set">
            <button className="set-line" onClick={() => setEditing(editing === i ? null : i)} aria-expanded={editing === i}>
              <span className="set-n">{i + 1}</span>
              <span className="set-what">
                {it.kind === 'jump' ? `${l.reps} jumps${l.h ? ` · ${l.h} in` : ''}` : `${it.bw && !l.w ? 'BW' : `${l.w} lb`} × ${l.reps}${it.unit === 'm' ? ' m' : ''}`}
              </span>
              {it.kind !== 'jump' && <span className={`rir-tag r${Math.min(4, l.rir)}`}>{l.rir >= 4 ? '4+' : l.rir} left</span>}
              <Icon name="check" size={16} />
            </button>
            {editing === i && (
              <div className="set-edit">
                {it.kind !== 'jump' && (
                  <>
                    <Stepper label="lb" value={l.w} step={it.inc} onChange={(v) => fixSet(i, { w: v })} />
                    <Stepper label={it.unit === 'm' ? 'm' : 'reps'} value={l.reps} step={it.unit === 'm' ? 5 : 1} onChange={(v) => fixSet(i, { reps: v })} />
                    <RirChips value={l.rir} onPick={(r) => fixSet(i, { rir: r })} />
                  </>
                )}
                <div className="btn-row">
                  <button className="mini" onClick={() => setEditing(null)}>Done</button>
                  <button className="mini danger-mini" onClick={() => dropSet(i)}>Remove set</button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!doneAll && (
          <li className="set current-set">
            <div className="set-line now">
              <span className="set-n">{log.length + 1}</span>
              {it.kind === 'jump' ? (
                <>
                  <span className="set-what">{it.reps} jumps, full reset each rep</span>
                </>
              ) : (
                <Stepper label={it.unit === 'm' ? 'm' : 'reps'} value={curReps} step={it.unit === 'm' ? 5 : 1} onChange={setReps} />
              )}
            </div>
            {it.kind === 'jump' ? (
              <div className="jump-log">
                <input className="input h-in" inputMode="decimal" placeholder="Height (in, optional)" value={h} onChange={(e) => setH(e.target.value.replace(/[^\d.]/g, ''))} />
                <button className="btn" onClick={(e) => logSet(null, e.currentTarget)}>Log set</button>
              </div>
            ) : it.w == null && !it.bw ? (
              <p className="hint">{it.assist ? `Pick enough help above to get ${it.reps} reps with 1–2 left. Less help is harder.` : `Pick a starting weight above: one you could do for ${it.reps} with ${isMain ? '2–3' : '1–2'} reps left.`}</p>
            ) : (
              <>
                <p className="rir-q">Reps left in the tank? Tap to log the set.</p>
                <RirChips onPick={(r, el) => logSet(r, el)} target={it.rir} />
              </>
            )}
          </li>
        )}
      </ol>
      {doneAll && (
        <button className="link-btn" onClick={() => updItem(it.key, (x) => ({ ...x, sets: x.sets + 1 }))}>+ Add a set</button>
      )}
    </section>
  );
}

export function Stepper({ label, value, step = 1, onChange }) {
  const v = Number(value) || 0;
  return (
    <span className="stepper num-step">
      <button className="icon-btn sm" aria-label={`Less ${label}`} onClick={() => onChange(Math.max(0, v - step))}><Icon name="minus" size={16} /></button>
      <b>{v}<small> {label}</small></b>
      <button className="icon-btn sm" aria-label={`More ${label}`} onClick={() => onChange(v + step)}><Icon name="plus" size={16} /></button>
    </span>
  );
}

function RirChips({ value, onPick, target }) {
  return (
    <div className="rir-chips" role="group" aria-label="Reps left in the tank">
      {[0, 1, 2, 3, 4].map((r) => (
        <button
          key={r}
          className={`rir-chip r${r}${target != null && (r === target || (target === 2 && r === 3) || (target === 1 && r === 2)) ? ' aim' : ''}`}
          aria-pressed={value === r}
          onClick={(e) => onPick(r, e.currentTarget)}
        >
          <b>{r === 4 ? '4+' : r}</b>
          <span>{r === 0 ? 'failure' : r === 4 ? 'easy' : 'left'}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Finishing ---------- */

function FinishSheet({ session, onClose }) {
  const sessions = useSessions();
  const s = useSettings();
  const [pain, setPain] = useState(session.backPain ?? 0);
  const [trigger, setTrigger] = useState(session.trigger || '');
  const [notes, setNotes] = useState(session.text || '');
  const loggedItems = (session.items || []).filter((it) => (it.log || []).length);

  const save = (e) => {
    const finished = { ...session, status: 'done', backPain: pain, trigger: pain > 3 ? trigger : '', text: notes.trim(), finishedAt: new Date().toISOString() };
    const prs = prsIn(finished, sessions);
    patch(session.id, { status: 'done', backPain: pain, trigger: finished.trigger, text: finished.text, finishedAt: finished.finishedAt, prs });
    // A weight you set by hand in Plan is used once, then the engine takes over again.
    const used = new Set(loggedItems.map((it) => it.ex));
    const nw = { ...(s.nextWeights || {}) };
    let changed = false;
    for (const k of Object.keys(nw)) if (used.has(k)) { delete nw[k]; changed = true; }
    if (changed) saveSettings({ nextWeights: nw });
    stopRest();
    const sets = loggedItems.reduce((t, it) => t + it.log.length, 0);
    const volume = loggedItems.filter((it) => it.kind !== 'jump').reduce((t, it) => t + it.log.reduce((a, l) => a + (Number(l.w) || 0) * (l.reps || 0), 0), 0);
    const mins = session.startedAt ? Math.round((Date.now() - Date.parse(session.startedAt)) / 60000) : null;
    // The workout screen goes away once it's saved, so the summary opens as its own sheet.
    open('summary', session.id, { prs, sets, volume, mins, pain });
    haptic(prs.length ? 'big' : 'success');
    cheer(e.currentTarget, { text: prs.length ? `${prs.length} PR${prs.length > 1 ? 's' : ''}!` : 'Workout done', sub: dayLabel(session.day) });
  };

  return (
    <Sheet title="Finish workout" onClose={onClose}>
      <h3 className="sub-h">Back discomfort today</h3>
      <div className="pain-scale" role="group" aria-label="Back discomfort, 0 to 10">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} className={`pain p${i <= 3 ? 'ok' : i <= 6 ? 'mid' : 'hi'}`} aria-pressed={pain === i} onClick={() => setPain(i)}>{i}</button>
        ))}
      </div>
      <p className="muted small">Up to 3 that settles by tomorrow is OK. Above that, the next lower-body lift starts lighter.</p>
      {pain > 3 && (
        <label className="f">
          What came right before it?
          <select className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            <option value="">Pick an exercise</option>
            {loggedItems.map((it) => <option key={it.key} value={it.ex}>{it.name}</option>)}
          </select>
        </label>
      )}
      <label className="f" style={{ marginTop: 12 }}>
        Notes
        <textarea className="input" rows={2} placeholder="How it felt, gym, anything to remember" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button className="btn wide big-btn" onClick={save}>Save workout</button>
    </Sheet>
  );
}

/** Shown after saving a workout: sets, volume, time and any records. */
export function SummarySheet({ result, onClose }) {
  const pain = result.pain;
    return (
      <Sheet title="Nice work" onClose={onClose}>
        <div className="tiles tiles-3">
          <div className="tile"><span>Sets</span><b>{result.sets}</b></div>
          <div className="tile"><span>Volume</span><b>{result.volume >= 1000 ? `${(result.volume / 1000).toFixed(1)}k` : result.volume}</b></div>
          <div className="tile"><span>Minutes</span><b>{result.mins ?? '—'}</b></div>
        </div>
        {result.prs.length > 0 ? (
          <>
            <h3 className="sub-h">Personal records</h3>
            <ul className="rows pr-list">
              {result.prs.map((p) => <li key={p.ex} className="row"><Icon name="star" size={16} /><span className="row-title">{p.text}</span>{p.value && p.ex !== 'boxjump' && p.ex !== 'broadjump' && p.ex !== 'cmj' ? <span className="meta">est. max {p.value}</span> : null}</li>)}
            </ul>
          </>
        ) : (
          <p className="muted">No new records today. Next session’s weights are already worked out from what you just did.</p>
        )}
        {pain > 3 && <p className="adj-note k-back">Back at {pain}/10: next session’s lower-body main lift starts 10% lighter. If it’s sharp, lingers, or runs down a leg, see a physical therapist.</p>}
        <button className="btn wide" onClick={onClose}>Done</button>
      </Sheet>
    );
}

/** Past session details (from Progress or Today). */
export function SessionSheet({ id, sessions, onClose }) {
  const s = sessions.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(false);
  if (!s) return null;
  const sore = Object.entries((s.check && s.check.sore) || {}).filter(([, v]) => v > 0);
  return (
    <Sheet title={`${dayLabel(s.day)} · ${fmt(s.date, { month: 'short', day: 'numeric' })}`} onClose={onClose}>
      <p className="sheet-sub">
        {s.week != null ? `Week ${s.week}${s.deload ? ' (deload)' : ''} · ` : ''}{DAYS[s.day].name}
        {s.backPain != null ? ` · back ${s.backPain}/10${s.trigger ? ` after ${exName(s.trigger)}` : ''}` : ''}
      </p>
      {sore.length > 0 && (
        <div className="chips" style={{ marginBottom: 10 }}>
          {sore.map(([m, v]) => <span key={m} className={`chip sore-mini s${v}`}>{MUSCLES.find((x) => x.id === m)?.name} {v}</span>)}
        </div>
      )}
      <ul className="rows">
        {(s.items || []).map((it) => (
          <li key={it.key} className="row hist-ex">
            <span className="row-title">
              <b>{it.name}</b>
              <span className="muted small">
                {it.skipped && !(it.log || []).length ? `Skipped · ${it.skipped}` : (it.log || []).map((l) => (it.kind === 'jump' ? `${l.reps}${l.h ? ` @${l.h}in` : ''}` : `${l.w}×${l.reps}${l.rir != null ? ` (${l.rir})` : ''}`)).join(', ') || 'Not done'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {s.text && <p className="muted">“{s.text}”</p>}
      {(s.prs || []).length > 0 && <p className="hint">PRs: {s.prs.map((p) => p.text).join(' · ')}</p>}
      <div className="btn-row">
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className={`btn ${confirm ? 'danger' : 'ghost'}`} onClick={() => {
          if (!confirm) return setConfirm(true);
          remove(s.id);
          toast('Workout deleted');
          onClose();
        }}>{confirm ? 'Tap again to delete' : 'Delete'}</button>
      </div>
    </Sheet>
  );
}
