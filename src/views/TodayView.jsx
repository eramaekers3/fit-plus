import { useEffect, useMemo, useState } from 'react';
import { useSettings, saveSettings } from '../store.js';
import { useSessions, useCardio, useFood, useWeighs, useVerts, useOpenSession, useProteinTarget, logProtein } from '../lib/data.js';
import { prescribe, weekInfo, nextDay, weekSummary, weightTrend, avg7 } from '../lib/engine.js';
import { DAYS, dayLabel } from '../lib/program.js';
import { todayISO, addDays, fmt, weekStart, minToLabel, nowMin } from '../lib/dates.js';
import { useBusyDays } from '../lib/calendar.js';
import { planWeek } from '../lib/weekplan.js';
import { goTab, quickLog, openVert, openSession } from '../lib/open.js';
import { startSession, rx } from './TrainView.jsx';
import CardStack from '../components/CardStack.jsx';
import { CountUp, Icon, Ring } from '../components/ui.jsx';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';

export default function TodayView() {
  const s = useSettings();
  const today = todayISO();
  const wk = weekInfo(today, s.programStart);
  const head =
    wk.week == null ? 'Set up your 8 weeks'
    : wk.week === 0 ? `Week 1 in ${wk.startsIn} day${wk.startsIn === 1 ? '' : 's'}`
    : `Week ${wk.week}${wk.block > 1 ? ` · block ${wk.block}` : ''}`;

  return (
    <>
      <header className="dayhead">
        <div>
          <div className="eyebrow">{fmt(today, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <h1>
            {head}
            <span>{wk.phase ? `${wk.phase.name} · ${wk.phase.note}` : 'Pick the Monday your first week starts.'}</span>
          </h1>
        </div>
        {wk.week > 0 && <WeekPips week={wk.week} />}
      </header>

      {!s.programStart && <StartCard />}

      <CardStack
        page="today"
        cards={[
          { id: 'workout', title: 'Workout', node: <WorkoutCard /> },
          { id: 'week', title: 'This week', node: <WeekCard /> },
          { id: 'protein', title: 'Protein', node: <ProteinCard /> },
          { id: 'weight', title: 'Weight', node: <WeightCard /> },
          { id: 'vert', title: 'Vertical', node: <VertCard /> },
        ]}
      />
    </>
  );
}

function WeekPips({ week }) {
  return (
    <div className="week-pips" aria-label={`Week ${week} of 8`}>
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} className={`${i + 1 < week ? 'past' : i + 1 === week ? 'on' : ''}${i === 3 || i === 7 ? ' dl' : ''}`} />
      ))}
      <span>of 8</span>
    </div>
  );
}

/** Pick when week 1 starts. Shown until you do. */
export function StartCard() {
  const today = todayISO();
  const nextMon = addDays(weekStart(today), 7);
  const [date, setDate] = useState(nextMon);
  return (
    <section className="card start-card">
      <div className="card-head"><h2>Start the program</h2></div>
      <p>Pick the Monday week 1 starts. Until then you’re in week 0: test your vertical and get your starting weights.</p>
      <div className="chips">
        <button className="chip" aria-pressed={date === weekStart(today)} onClick={() => setDate(weekStart(today))}>This week ({fmt(weekStart(today), { month: 'short', day: 'numeric' })})</button>
        <button className="chip" aria-pressed={date === nextMon} onClick={() => setDate(nextMon)}>Next Monday ({fmt(nextMon, { month: 'short', day: 'numeric' })})</button>
      </div>
      <div className="inline" style={{ marginTop: 10 }}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn" onClick={(e) => { saveSettings({ programStart: weekStart(date) }); haptic('success'); cheer(e.currentTarget, { text: 'Program set' }); }}>Start</button>
      </div>
    </section>
  );
}

function WorkoutCard() {
  const s = useSettings();
  const sessions = useSessions();
  const cardio = useCardio();
  const open = useOpenSession();
  const today = todayISO();
  const nd = useMemo(() => nextDay(sessions, today), [sessions, today]);
  const todays = sessions.find((x) => x.date === today && x.status === 'done');
  const preview = useMemo(() => (nd.next ? prescribe({ day: nd.next, date: today, sessions, settings: s }) : null), [nd.next, today, sessions, s]);

  if (open) {
    const sets = (open.items || []).reduce((t, it) => t + (it.log || []).length, 0);
    return (
      <section className="card workout-card live">
        <div className="card-head"><h2>Workout</h2><span className="meta live-dot">In progress</span></div>
        <p className="big-line">{dayLabel(open.day)} · {DAYS[open.day].short}</p>
        <p className="muted small">{open.status === 'check' ? 'Body check not finished yet.' : `${sets} sets logged.`}</p>
        <button className="btn wide" onClick={() => goTab('train')}>Continue</button>
      </section>
    );
  }
  if (todays) {
    const sets = (todays.items || []).reduce((t, it) => t + (it.log || []).length, 0);
    return (
      <section className="card workout-card">
        <div className="card-head"><h2>Workout</h2><span className="meta pos">Done ✓</span></div>
        <p className="big-line">{dayLabel(todays.day)} · {sets} sets</p>
        {(todays.prs || []).length > 0 && <p className="hint">PRs: {todays.prs.map((p) => p.text).join(' · ')}</p>}
        <button className="link-btn" onClick={() => openSession(todays.id)}>See the workout →</button>
      </section>
    );
  }
  if (!nd.next) {
    return (
      <section className="card workout-card">
        <div className="card-head"><h2>Workout</h2><span className="meta pos">3/3 this week</span></div>
        <p className="big-line">All three lifts done.</p>
        <p className="muted small">Zone 2, basketball, or a long easy walk today.</p>
        <button className="mini" onClick={() => quickLog('cardio')}><Icon name="heart" size={14} /> Log cardio</button>
      </section>
    );
  }
  const main = preview.items.find((it) => it.kind === 'main') || preview.items[1];
  return (
    <section className="card workout-card">
      <div className="card-head">
        <h2>Up next</h2>
        <span className="meta">{nd.doneThisWeek.size}/3 this week</span>
      </div>
      <p className="big-line">{dayLabel(nd.next)} · {DAYS[nd.next].short}</p>
      {main && <p className="main-lift"><Icon name="train" size={16} /> {main.name}: <b>{rx(main)}</b></p>}
      <p className="muted small">{preview.items.map((it) => it.name).slice(2).join(' · ')}</p>
      {nd.liftedYesterday && <p className="muted small">You lifted yesterday, so a zone 2 day would be better if you can.</p>}
      <button className="btn wide" onClick={() => { startSession(nd.next, sessions, cardio); goTab('train'); }}>Start {dayLabel(nd.next)}</button>
    </section>
  );
}

function WeekCard() {
  const s = useSettings();
  const sessions = useSessions();
  const cardio = useCardio();
  const today = todayISO();
  const w = useMemo(() => weekSummary({ date: today, sessions, cardio, goal: s.zone2Goal }), [today, sessions, cardio, s.zone2Goal]);
  return (
    <section className="card week-card">
      <div className="card-head">
        <h2>This week</h2>
        <button className="mini" onClick={() => quickLog('cardio')}><Icon name="plus" size={13} /> Cardio</button>
      </div>
      <WeekPlan />
      <div className="week-rings">
        <div className="wr">
          <Ring p={w.lifts.length / 3} size={58} stroke={7}><b>{w.lifts.length}</b><span>/3</span></Ring>
          <span>Lifts</span>
        </div>
        <div className="wr">
          <Ring p={w.z2 / w.z2Goal} size={58} stroke={7} color="var(--sky)"><b>{w.z2}</b><span>min</span></Ring>
          <span>Zone 2 of {w.z2Goal}</span>
        </div>
        <div className="wr">
          <Ring p={w.hard ? 1 : 0} size={58} stroke={7} color="var(--coral)"><b>{w.hard}</b><span>hard</span></Ring>
          <span>{w.hard ? 'Hard session ✓' : 'Hoops or 4×4'}</span>
        </div>
      </div>
    </section>
  );
}

const ICON = { lift: 'train', zone2: 'heart', walk: 'heart', bball: 'ball', intervals: 'bolt', rest: 'moon' };
const hm = minToLabel;

/** Each day of the week: what's done, and what's planned and when (around lifestyle+'s calendar). */
function WeekPlan() {
  const s = useSettings();
  const sessions = useSessions();
  const cardio = useCardio();
  const busy = useBusyDays();
  const today = todayISO();
  const [now, setNow] = useState(nowMin);
  useEffect(() => {
    const t = setInterval(() => setNow(nowMin()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const p = useMemo(() => planWeek({ today, now, busy, sessions, cardio, settings: s }), [today, now, busy, sessions, cardio, s]);
  const source = busy.loaded
    ? 'Times fit around your lifestyle+ calendar and blocks.'
    : busy.calendars
      ? 'Loading your lifestyle+ calendar…'
      : busy.blocks
        ? 'Times fit around your lifestyle+ blocks. Add calendars in lifestyle+ to include classes.'
        : 'Sign in to fit times around your lifestyle+ calendar.';

  return (
    <>
      <ol className="plan-days">
        {p.days.map((d) => (
          <li key={d.date} className={`pd${d.today ? ' today' : ''}${d.past ? ' past' : ''}`}>
            <span className="pd-day">
              <b>{fmt(d.date, { weekday: 'short' })}</b>
              <span>{fmt(d.date, { day: 'numeric' })}</span>
            </span>
            <span className="pd-items">
              {d.done.map((x, i) => (
                <button key={`d${i}`} className={`pd-chip done t-${x.type}`} onClick={() => x.id && openSession(x.id)} disabled={!x.id}>
                  <Icon name="check" size={12} /> {x.label}{x.min ? ` · ${x.min}m` : ''}
                </button>
              ))}
              {d.plan.map((x, i) => (
                <button
                  key={`p${i}`}
                  className={`pd-chip t-${x.type}`}
                  disabled={!(x.type === 'lift' && d.today) && x.type !== 'zone2' && x.type !== 'walk' && x.type !== 'intervals'}
                  onClick={() => (x.type === 'lift' ? goTab('train') : quickLog('cardio'))}
                >
                  <Icon name={ICON[x.type]} size={12} /> {x.label}
                  {x.start != null && <span className="pd-time">{hm(x.start)}</span>}
                </button>
              ))}
              {!d.done.length && !d.plan.length && d.past && <span className="pd-none">—</span>}
            </span>
            {d.free != null && <span className="pd-free">{d.allDay.length ? '★ ' : ''}{d.free >= 60 ? `${Math.round(d.free / 60)}h` : `${d.free}m`} free</span>}
          </li>
        ))}
      </ol>
      {p.notes.map((n) => <p key={n} className="plan-note">{n}</p>)}
      <p className="muted small plan-src">{source}</p>
    </>
  );
}

function ProteinCard() {
  const s = useSettings();
  const food = useFood();
  const target = useProteinTarget();
  const today = todayISO();
  const got = food.filter((f) => f.date === today).reduce((t, f) => t + (Number(f.g) || 0), 0);
  const left = Math.max(0, target - got);
  return (
    <section className="card protein-card">
      <div className="card-head">
        <h2>Protein</h2>
        <button className="mini" onClick={() => goTab('fuel')}>Details</button>
      </div>
      <div className="hero-row">
        <div>
          <div className="big"><CountUp value={got} /><span> / {target} g</span></div>
          <p className="muted small">{left ? `${left} g to go${left > 60 ? ` · about ${Math.ceil(left / 40)} more meal${Math.ceil(left / 40) > 1 ? 's' : ''}` : ''}` : 'Target hit for today.'}</p>
        </div>
        <Ring p={got / target} size={70} stroke={8} color="var(--mint)"><b>{Math.round((got / (target || 1)) * 100)}%</b></Ring>
      </div>
      <div className="chips meal-chips">
        {(s.meals || []).slice(0, 6).map((m) => (
          <button key={m.id} className="chip" onClick={(e) => { logProtein(m.g, m.name); haptic('success'); cheer(e.currentTarget, { text: `+${m.g} g` }); }}>
            {m.name} <span className="muted">{m.g}g</span>
          </button>
        ))}
        <button className="chip add-chip" onClick={() => quickLog('protein')}><Icon name="plus" size={13} /> Other</button>
      </div>
    </section>
  );
}

function WeightCard() {
  const weighs = useWeighs();
  const today = todayISO();
  const todayW = weighs.find((w) => w.date === today);
  const t = useMemo(() => weightTrend(weighs, today), [weighs, today]);
  const a = avg7(weighs, today);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Weight</h2>
        <button className="mini" onClick={() => quickLog('weight')}>{todayW ? 'Change' : 'Weigh in'}</button>
      </div>
      <div className="hero-row">
        <div>
          <div className="label">7-day average</div>
          <div className="big">{a ? a.toFixed(1) : '—'}<span> lb</span></div>
        </div>
        {t.rate != null && (
          <div className="right">
            <div className="label">This week</div>
            <div className={`delta ${t.verdict.tone}`}>{t.rate >= 0 ? '+' : ''}{t.rate.toFixed(1)} lb</div>
          </div>
        )}
      </div>
      <p className="muted small">{t.verdict ? t.verdict.text : todayW ? `Today: ${todayW.lb} lb. The trend shows after a week of weigh-ins.` : 'Weigh in each morning after the bathroom, before eating. The weekly average is what counts.'}</p>
    </section>
  );
}

function VertCard() {
  const s = useSettings();
  const verts = useVerts();
  const today = todayISO();
  const wk = weekInfo(today, s.programStart);
  const sorted = [...verts].sort((a, b) => a.date.localeCompare(b.date));
  const base = sorted[0];
  const last = sorted.at(-1);
  const due = wk.week === 0 || wk.week === 8 || !base;
  if (!due && !base) return null;
  return (
    <section className={`card vert-card${due ? ' due' : ''}`}>
      <div className="card-head">
        <h2>Vertical jump</h2>
        <button className="mini" onClick={openVert}>{due ? 'Test now' : 'Log a test'}</button>
      </div>
      {base ? (
        <div className="hero-row">
          <div>
            <div className="label">{sorted.length > 1 ? 'Latest' : 'Baseline'}</div>
            <div className="big">{last.vertical}<span> in</span></div>
          </div>
          {sorted.length > 1 && (
            <div className="right">
              <div className="label">Since {fmt(base.date, { month: 'short', day: 'numeric' })}</div>
              <div className={`delta ${last.vertical >= base.vertical ? 'pos' : 'neg'}`}>{last.vertical >= base.vertical ? '+' : ''}{(last.vertical - base.vertical).toFixed(1)} in</div>
            </div>
          )}
        </div>
      ) : (
        <p>Get your baseline before week 1: standing reach, then the best of 3 jumps. Video it.</p>
      )}
      {wk.week === 8 && <p className="hint">Retest at the end of this week, rested.</p>}
      {wk.week > 0 && wk.week < 8 && base && <p className="muted small">Retest in week 8 ({fmt(addDays(wk.weekStart, (8 - wk.week) * 7 + 4), { month: 'short', day: 'numeric' })}).</p>}
    </section>
  );
}
