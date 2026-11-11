import { useMemo, useState } from 'react';
import { useSettings } from '../store.js';
import { useSessions, useCardio, useVerts } from '../lib/data.js';
import { e1Series, weekSummary, setsPerMuscle, sorePatterns, done } from '../lib/engine.js';
import { MUSCLES, DAYS, dayLabel, exName } from '../lib/program.js';
import { todayISO, addDays, fmt, weekStart } from '../lib/dates.js';
import { openSession, openVert, openExercise } from '../lib/open.js';
import { LineChart, BandBars, ColBars } from '../components/Charts.jsx';
import CardStack from '../components/CardStack.jsx';
import { Icon } from '../components/ui.jsx';

const MAIN_LIFTS = [
  { ex: 'trapbar', alts: [] },
  { ex: 'bench', alts: ['dbbench'] },
  { ex: 'frontsquat', alts: ['ssbsquat'] },
];

export default function ProgressView() {
  const sessions = useSessions();
  const n = done(sessions).length;
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Progress</div>
        <h1>{n} workout{n === 1 ? '' : 's'}</h1>
        <p>Estimated maxes, weekly sets per muscle, your vertical, cardio and your back.</p>
      </header>
      <CardStack
        page="progress"
        cards={[
          { id: 'vert', title: 'Vertical', node: <Vertical /> },
          { id: 'lifts', title: 'Main lifts', node: <MainLifts /> },
          { id: 'muscles', title: 'Sets per muscle', node: <Muscles /> },
          { id: 'cardio', title: 'Cardio', node: <Cardio /> },
          { id: 'back', title: 'Back', node: <Back /> },
          { id: 'prs', title: 'Records', node: <Records /> },
          { id: 'history', title: 'History', node: <History /> },
        ]}
      />
    </>
  );
}

function Vertical() {
  const verts = useVerts();
  const sorted = [...verts].sort((a, b) => a.date.localeCompare(b.date));
  const base = sorted[0];
  const last = sorted.at(-1);
  return (
    <section className="card">
      <div className="card-head"><h2>Vertical jump</h2><button className="mini" onClick={openVert}>Log a test</button></div>
      {!base ? (
        <p className="empty">No test yet. Do one in week 0 and again at the end of week 8.</p>
      ) : (
        <>
          <div className={`tiles ${sorted.length > 1 ? 'tiles-3' : ''}`}>
            <div className="tile"><span>Baseline</span><b>{base.vertical}″</b></div>
            {sorted.length > 1 && <>
            <div className="tile"><span>Latest</span><b>{last.vertical}″</b></div>
            <div className="tile"><span>Change</span><b className={last.vertical >= base.vertical ? 'pos' : 'neg'}>{last.vertical >= base.vertical ? '+' : ''}{(last.vertical - base.vertical).toFixed(1)}″</b></div>
            </>}
            {sorted.length === 1 && <div className="tile"><span>Retest</span><b>Week 8</b></div>}
          </div>
          {sorted.length > 1 && <LineChart points={sorted.map((v) => ({ date: v.date, v: v.vertical }))} unit="″" label="Vertical jump" />}
        </>
      )}
    </section>
  );
}

function MainLifts() {
  const sessions = useSessions();
  const s = useSettings();
  const [pick, setPick] = useState(0);
  const lift = MAIN_LIFTS[pick];
  const exId = (s.swaps || {})[lift.ex] || lift.ex;
  const series = useMemo(() => e1Series(sessions, exId), [sessions, exId]);
  const last = series.at(-1);
  const first = series[0];
  return (
    <section className="card">
      <div className="card-head"><h2>Estimated max</h2>{last && <span className="meta">{last.v} lb</span>}</div>
      <div className="seg lift-seg" role="group" aria-label="Lift">
        {MAIN_LIFTS.map((l, i) => (
          <button key={l.ex} aria-pressed={pick === i} onClick={() => setPick(i)}>{exName((s.swaps || {})[l.ex] || l.ex).replace(' deadlift', '').replace(' press', '')}</button>
        ))}
      </div>
      <LineChart points={series} label={`${exName(exId)} estimated max`} unit="" />
      {first && last && series.length > 1 && (
        <p className="muted small">
          {last.v >= first.v ? '+' : ''}{last.v - first.v} lb since {fmt(first.date, { month: 'short', day: 'numeric' })}. Estimated from your best set each session, counting reps left in the tank.
        </p>
      )}
      <button className="link-btn" onClick={() => openExercise(exId)}>{exName(exId)} details →</button>
    </section>
  );
}

function Muscles() {
  const sessions = useSessions();
  const today = todayISO();
  const [weeksBack, setWeeksBack] = useState(0);
  const ws = addDays(weekStart(today), -7 * weeksBack);
  const inWeek = useMemo(() => done(sessions).filter((x) => x.date >= ws && x.date <= addDays(ws, 6)), [sessions, ws]);
  const per = setsPerMuscle(inWeek);
  const rows = MUSCLES.filter((m) => m.id !== 'lowback').map((m) => ({ id: m.id, name: m.name, v: per[m.id] }));
  const pats = sorePatterns(sessions, today);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Sets per muscle</h2>
        <span className="mo-nav">
          <button className="icon-btn sm" aria-label="Earlier week" onClick={() => setWeeksBack(weeksBack + 1)}><Icon name="left" size={16} /></button>
          <b className="small">{weeksBack ? `Week of ${fmt(ws, { month: 'short', day: 'numeric' })}` : 'This week'}</b>
          <button className="icon-btn sm" aria-label="Later week" disabled={!weeksBack} onClick={() => setWeeksBack(weeksBack - 1)}><Icon name="right" size={16} /></button>
        </span>
      </div>
      <BandBars rows={rows} lo={10} hi={20} max={24} />
      <p className="muted small">The shaded band is Galpin’s 10–20 hard sets per muscle per week. Secondary muscles count half a set. Jumps aren’t counted.</p>
      {pats.length > 0 && (
        <div className="flag">
          <b>Often sore:</b> {pats.map((p) => `${p.name} (${p.n} of last ${p.of})`).join(', ')}. If it keeps up, trim a set for that muscle in the week.
        </div>
      )}
    </section>
  );
}

function Cardio() {
  const s = useSettings();
  const sessions = useSessions();
  const cardio = useCardio();
  const today = todayISO();
  const cols = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = addDays(weekStart(today), -7 * (5 - i));
        const w = weekSummary({ date: d, sessions, cardio, goal: s.zone2Goal });
        return { key: d, label: fmt(d, { month: 'numeric', day: 'numeric' }), v: w.z2, now: i === 5, hard: w.hard };
      }),
    [today, sessions, cardio, s.zone2Goal]
  );
  return (
    <section className="card">
      <div className="card-head"><h2>Zone 2 per week</h2><span className="meta">goal {s.zone2Goal} min</span></div>
      <ColBars cols={cols} goal={s.zone2Goal} />
      <p className="muted small">Hard sessions: {cols.map((c) => (c.hard ? '●' : '○')).join(' ')} (basketball or 4×4s, one a week)</p>
    </section>
  );
}

function Back() {
  const sessions = useSessions();
  const list = done(sessions).filter((x) => x.backPain != null).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const flares = list.filter((x) => x.backPain > 3);
  const triggers = flares.reduce((m, x) => (x.trigger ? { ...m, [x.trigger]: (m[x.trigger] || 0) + 1 } : m), {});
  return (
    <section className="card">
      <div className="card-head"><h2>Back</h2><span className="meta">{flares.length ? `${flares.length} over 3/10` : 'No flare-ups'}</span></div>
      {list.length === 0 ? (
        <p className="empty">You rate your back at the end of each workout. It shows here.</p>
      ) : (
        <div className="back-strip">
          {[...list].reverse().map((x) => (
            <button key={x.id} className={`bk ${x.backPain > 3 ? 'hi' : x.backPain > 1 ? 'mid' : 'ok'}`} style={{ '--h': `${Math.max(8, x.backPain * 10)}%` }} onClick={() => openSession(x.id)} title={`${fmt(x.date, { month: 'short', day: 'numeric' })}: ${x.backPain}/10`}>
              <i /><span>{x.backPain}</span>
            </button>
          ))}
        </div>
      )}
      {Object.keys(triggers).length > 0 && (
        <p className="flag"><b>Came before flare-ups:</b> {Object.entries(triggers).map(([k, n]) => `${exName(k)} (${n})`).join(', ')}</p>
      )}
    </section>
  );
}

function Records() {
  const sessions = useSessions();
  const prs = done(sessions).sort((a, b) => b.date.localeCompare(a.date)).flatMap((x) => (x.prs || []).map((p) => ({ ...p, date: x.date, id: x.id }))).slice(0, 10);
  return (
    <section className="card">
      <div className="card-head"><h2>Records</h2></div>
      {prs.length === 0 ? (
        <p className="empty">New best estimated maxes and jump heights land here.</p>
      ) : (
        <ul className="rows pr-list">
          {prs.map((p, i) => (
            <li key={i} className="row">
              <Icon name="star" size={16} />
              <span className="row-title">{p.text}</span>
              <span className="meta">{fmt(p.date, { month: 'short', day: 'numeric' })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function History() {
  const sessions = useSessions();
  const [all, setAll] = useState(false);
  const list = done(sessions).sort((a, b) => b.date.localeCompare(a.date));
  const shown = all ? list : list.slice(0, 8);
  return (
    <section className="card">
      <div className="card-head"><h2>History</h2><span className="meta">{list.length}</span></div>
      {list.length === 0 ? (
        <p className="empty">Finished workouts show up here.</p>
      ) : (
        <ul className="rows">
          {shown.map((x) => {
            const sets = (x.items || []).reduce((t, it) => t + (it.log || []).length, 0);
            return (
              <li key={x.id} className="row">
                <button className="task-open row-title hist-open" onClick={() => openSession(x.id)}>
                  <b>{dayLabel(x.day)} · {DAYS[x.day].short}</b>
                  <span className="muted small">{fmt(x.date, { weekday: 'short', month: 'short', day: 'numeric' })}{x.week ? ` · week ${x.week}` : ''} · {sets} sets{(x.prs || []).length ? ` · ${x.prs.length} PR` : ''}</span>
                </button>
                <Icon name="right" size={16} />
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 8 && <button className="link-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
    </section>
  );
}
