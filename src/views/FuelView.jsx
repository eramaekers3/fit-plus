import { useMemo } from 'react';
import { useSettings } from '../store.js';
import { useFood, useWeighs, useProteinTarget, logProtein, deleteRecord } from '../lib/data.js';
import { avg7, weightTrend, latestWeight } from '../lib/engine.js';
import { todayISO, addDays, fmt } from '../lib/dates.js';
import { quickLog } from '../lib/open.js';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';
import { toast } from '../lib/toast.js';
import { put } from '../store.js';
import { CountUp, Icon, Ring } from '../components/ui.jsx';
import { LineChart, ColBars } from '../components/Charts.jsx';
import CardStack from '../components/CardStack.jsx';

export default function FuelView() {
  const s = useSettings();
  const weighs = useWeighs();
  const target = useProteinTarget();
  const weight = latestWeight(weighs, s);
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Fuel</div>
        <h1>{target} g protein</h1>
        <p>{s.proteinPerLb} g per pound at {Math.round(weight)} lb. Hit this most days and let the scale tell you if you’re eating enough overall.</p>
      </header>
      <CardStack
        page="fuel"
        cards={[
          { id: 'today', title: 'Today', node: <TodayProtein target={target} /> },
          { id: 'week', title: 'Last 7 days', node: <ProteinWeek target={target} /> },
          { id: 'weight', title: 'Weight', node: <WeightTrend /> },
          { id: 'how', title: 'Finding protein', node: <HowTo /> },
        ]}
      />
    </>
  );
}

function TodayProtein({ target }) {
  const s = useSettings();
  const food = useFood();
  const today = todayISO();
  const list = food.filter((f) => f.date === today).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  const got = list.reduce((t, f) => t + (Number(f.g) || 0), 0);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Today</h2>
        <button className="mini sun" onClick={() => quickLog('protein')}><Icon name="plus" size={13} /> Log</button>
      </div>
      <div className="hero-row">
        <div>
          <div className="big"><CountUp value={got} /><span> / {target} g</span></div>
          <p className="muted small">{got >= target ? 'Done for today.' : `${target - got} g to go`}</p>
        </div>
        <Ring p={got / (target || 1)} size={78} stroke={8} color="var(--mint)"><b>{Math.round((got / (target || 1)) * 100)}%</b></Ring>
      </div>
      <div className="chips meal-chips">
        {(s.meals || []).map((m) => (
          <button key={m.id} className="chip" onClick={(e) => { logProtein(m.g, m.name); haptic('success'); cheer(e.currentTarget, { text: `+${m.g} g` }); }}>
            {m.name} <span className="muted">{m.g}g</span>
          </button>
        ))}
      </div>
      {list.length > 0 && (
        <ul className="rows food-rows">
          {list.map((f) => (
            <li key={f.id} className="row">
              <span className="row-title">{f.label || 'Protein'}</span>
              <span className="meta">{f.g} g</span>
              <button className="x" aria-label="Remove" onClick={() => {
                deleteRecord(f.id);
                toast('Removed', { label: 'Undo', run: () => put('food', f) });
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProteinWeek({ target }) {
  const food = useFood();
  const today = todayISO();
  const cols = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i - 6);
        return { key: d, label: fmt(d, { weekday: 'narrow' }), v: food.filter((f) => f.date === d).reduce((t, f) => t + (Number(f.g) || 0), 0), now: d === today };
      }),
    [food, today]
  );
  const hit = cols.filter((c) => c.v >= target).length;
  return (
    <section className="card">
      <div className="card-head"><h2>Last 7 days</h2><span className="meta">{hit}/7 days on target</span></div>
      <ColBars cols={cols} goal={target} />
    </section>
  );
}

function WeightTrend() {
  const weighs = useWeighs();
  const today = todayISO();
  const t = useMemo(() => weightTrend(weighs, today), [weighs, today]);
  const from = addDays(today, -60);
  const recent = [...weighs].filter((w) => w.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const line = recent.map((w) => ({ date: w.date, v: avg7(weighs, w.date) }));
  const todayW = weighs.find((w) => w.date === today);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Weight</h2>
        <button className="mini" onClick={() => quickLog('weight')}>{todayW ? `Today ${todayW.lb}` : 'Weigh in'}</button>
      </div>
      <div className="hero-row">
        <div>
          <div className="label">7-day average</div>
          <div className="big">{t.now ? t.now.toFixed(1) : '—'}<span> lb</span></div>
        </div>
        {t.rate != null && (
          <div className="right">
            <div className="label">Per week</div>
            <div className={`delta ${t.verdict.tone}`}>{t.rate >= 0 ? '+' : ''}{t.rate.toFixed(2)} lb</div>
          </div>
        )}
      </div>
      <LineChart points={line} dots={recent.map((w) => ({ date: w.date, v: Number(w.lb) }))} label="Weight, 7-day average" color="var(--coral)" />
      <p className="muted small">
        {t.verdict ? t.verdict.text : 'Aim to gain about 0.25–0.5 lb a week while building. One weigh-in means little; the weekly average tells the story.'}
      </p>
    </section>
  );
}

function HowTo() {
  return (
    <section className="card how-card">
      <div className="card-head"><h2>Finding protein</h2></div>
      <ol className="steps">
        <li>Look up your usual campus orders once at <a className="ink" href="https://menu.unl.edu" target="_blank" rel="noreferrer">menu.unl.edu</a> — add items to “My Meal” for a whole order’s numbers.</li>
        <li>Save each one as a meal here (Log → “Save as a meal”). After that it’s one tap.</li>
        <li>No label? Estimate: palm of meat ≈ 25–30 g, 2 eggs ≈ 12 g, cup of Greek yogurt ≈ 20 g, shake ≈ 25 g.</li>
      </ol>
      <p className="muted small">Short on a day? A shake or Greek yogurt closes the gap. Roughly right every day beats exact once in a while.</p>
    </section>
  );
}
