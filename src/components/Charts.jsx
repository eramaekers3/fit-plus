// Small charts in the lifestyle+ style: thin grid, accent line, a dot on the latest point.
import { fmt } from '../lib/dates.js';

const nice = (lo, hi) => {
  if (hi - lo < 1) return [Math.floor(lo - 1), Math.ceil(hi + 1)];
  const pad = (hi - lo) * 0.15;
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
};

/**
 * A line over time.
 *   points:  [{ date, v }] oldest first
 *   dots:    optional raw points drawn faintly behind (e.g. each weigh-in under the 7-day average)
 *   unit:    label suffix for the axis
 */
export function LineChart({ points, dots = [], unit = '', label = 'Chart', color = 'var(--sun)', height = 130 }) {
  const all = [...points, ...dots];
  if (points.length < 2) return <p className="empty">A line shows up here after a couple of entries.</p>;
  const W = 340, H = height, L = 36, R = 10, T = 10, B = 20;
  const t0 = Date.parse(all.reduce((a, p) => (p.date < a ? p.date : a), all[0].date));
  const t1 = Date.parse(all.reduce((a, p) => (p.date > a ? p.date : a), all[0].date));
  const [lo, hi] = nice(Math.min(...all.map((p) => p.v)), Math.max(...all.map((p) => p.v)));
  const x = (d) => L + (W - L - R) * (t1 === t0 ? 0.5 : (Date.parse(d) - t0) / (t1 - t0));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const last = points.at(-1);
  return (
    <svg className="chart line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">{Math.round(v)}{unit}</text>
        </g>
      ))}
      {dots.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.v)} r="2.4" className="dot" />)}
      <polyline className="ln" points={points.map((p) => `${x(p.date)},${y(p.v)}`).join(' ')} style={{ stroke: color }} pathLength="1" />
      <circle cx={x(last.date)} cy={y(last.v)} r="4.5" className="end" style={{ fill: color }} />
      <text x={L} y={H - 4}>{fmt(all[0].date, { month: 'short', day: 'numeric' })}</text>
      <text x={W - R} y={H - 4} textAnchor="end">{fmt(last.date, { month: 'short', day: 'numeric' })}</text>
    </svg>
  );
}

/**
 * Horizontal bars against a target band (e.g. weekly sets per muscle vs 10–20).
 *   rows: [{ id, name, v }]
 */
export function BandBars({ rows, lo, hi, max }) {
  const top = max || Math.max(hi * 1.25, ...rows.map((r) => r.v));
  return (
    <ul className="band-bars">
      {rows.map((r, i) => {
        const tone = r.v >= hi ? 'over' : r.v >= lo ? 'in' : r.v > 0 ? 'under' : 'zero';
        return (
          <li key={r.id} style={{ '--i': i }}>
            <span className="bb-name">{r.name}</span>
            <span className="bb-track">
              <i className="bb-band" style={{ left: `${(lo / top) * 100}%`, width: `${((hi - lo) / top) * 100}%` }} />
              <i className={`bb-fill ${tone}`} style={{ width: `${Math.min(100, (r.v / top) * 100)}%` }} />
            </span>
            <b>{Number.isInteger(r.v) ? r.v : r.v.toFixed(1)}</b>
          </li>
        );
      })}
    </ul>
  );
}

/** Seven columns for a week (protein per day, minutes per week…). */
export function ColBars({ cols, goal, unit = '' }) {
  const top = Math.max(goal || 0, ...cols.map((c) => c.v), 1);
  return (
    <div className="col-bars">
      {cols.map((c, i) => (
        <div key={c.key} className={`cb${c.now ? ' now' : ''}`} style={{ '--i': i }}>
          <span className="cb-v">{c.v ? `${Math.round(c.v)}${unit}` : ''}</span>
          <span className="cb-track">
            {goal ? <i className="cb-goal" style={{ bottom: `${(goal / top) * 100}%` }} /> : null}
            <i className={`cb-fill${goal && c.v >= goal ? ' hit' : ''}`} style={{ height: `${(c.v / top) * 100}%` }} />
          </span>
          <span className="cb-k">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
