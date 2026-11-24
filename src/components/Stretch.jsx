import { useState } from 'react';
import { markStretched, useStretch, useStretched, whyLine } from '../lib/stretch.js';
import { RoutinePlayer, LibrarySheet } from './Routines.jsx';
import { Icon } from './ui.jsx';

const hold = (s) => (s.sides ? `${s.secs} sec each side` : `${s.secs} sec`);

/** Tonight's stretch: about 5 minutes, built from today's and yesterday's training. */
export default function StretchCard({ date }) {
  const plan = useStretch(date);
  const done = useStretched(date);
  const [playing, setPlaying] = useState(false);
  const [picking, setPicking] = useState(false);
  const mins = Math.round(plan.secs / 60);

  const body = (
    <>
      <p className="muted small st-why">{whyLine(plan)}</p>
      {plan.focus.length > 0 && (
        <div className="st-focus">
          {plan.focus.map((f) => <span key={f} className="st-tag">{f}</span>)}
        </div>
      )}
      <ol className="st-list">
        {plan.items.map((s) => (
          <li key={s.id}>
            <span className="st-name">{s.name}</span>
            <span className="st-hold">{hold(s)}</span>
          </li>
        ))}
      </ol>
      <button className={`btn wide st-go${done ? ' ghost' : ''}`} onClick={() => setPlaying(true)}>
        <Icon name={done ? 'moon' : 'play'} size={18} /> {done ? 'Stretched ✓ · Go again' : `Start · ${mins} min`}
      </button>
      <button className="link-btn center-link st-other" onClick={() => setPicking(true)}>Pick a different stretch</button>
      {playing && (
        <RoutinePlayer
          items={plan.items}
          kind="stretch"
          title="Tonight’s stretch"
          onClose={() => setPlaying(false)}
          onFinish={() => markStretched(date)}
          finishText={`${plan.items.length} stretches, ${mins} minutes. Lights out soon.`}
        />
      )}
      {picking && <LibrarySheet kind="stretch" onClose={() => setPicking(false)} />}
    </>
  );

  return (
    <section className="card st-card" aria-labelledby="st-h">
      <div className="card-head"><h2 id="st-h">Tonight’s stretch</h2><span className="meta">{done ? 'done ✓' : `~${mins} min`}</span></div>
      {body}
    </section>
  );
}
