import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSettings, useSyncStatus, clearSample } from './store.js';
import { Icon, Toaster, LogoMark } from './components/ui.jsx';
import { DEFAULT_LOGO } from './lib/logo.js';
import { useTheme, useLogoIcon } from './lib/theme.js';
import { useSwipe } from './lib/swipe.js';
import { useOpenSheet, closeSheet, quickLog } from './lib/open.js';
import { useRest, addRest, stopRest, clock } from './lib/rest.js';
import { useSessions } from './lib/data.js';
import TodayView from './views/TodayView.jsx';
import TrainView, { SessionSheet, SummarySheet } from './views/TrainView.jsx';
import FuelView from './views/FuelView.jsx';
import ProgressView from './views/ProgressView.jsx';
import PlanView, { ExerciseSheet } from './views/PlanView.jsx';
import QuickLog, { VertSheet } from './components/QuickLog.jsx';

// Settings opens now and then, so it loads separately (fetched in the background after start-up).
const loadSettings = () => import('./components/SettingsSheet.jsx');
const SettingsSheet = lazy(loadSettings);

const TABS = [
  { id: 'today', label: 'Today', View: TodayView },
  { id: 'train', label: 'Train', View: TrainView },
  { id: 'fuel', label: 'Fuel', View: FuelView },
  { id: 'progress', label: 'Progress', View: ProgressView },
  { id: 'plan', label: 'Plan', View: PlanView },
];

const tabFromHash = () => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? h : 'today';
};

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const tabRef = useRef(tab);
  const [enter, setEnter] = useState(0); // which side the new tab slides in from
  const pager = useRef(null);
  const [settings, setSettings] = useState(false);
  const s = useSettings();
  const sync = useSyncStatus();
  const sheet = useOpenSheet();
  const sessions = useSessions();
  useTheme();
  useLogoIcon();

  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => loadSettings().catch(() => {}));
  }, []);

  useEffect(() => {
    const onHash = () => {
      // Home Screen shortcuts: …/#protein opens the protein log.
      if (window.location.hash === '#protein') {
        history.replaceState(null, '', `#${tabRef.current}`);
        return quickLog('protein');
      }
      const next = tabFromHash();
      const idx = (id) => TABS.findIndex((t) => t.id === id);
      setEnter(Math.sign(idx(next) - idx(tabRef.current)));
      tabRef.current = next;
      setTab(next);
      window.scrollTo(0, 0);
    };
    if (window.location.hash === '#protein') onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // For a moment after a page appears, things already checked or picked don't replay their animations.
  const [settling, setSettling] = useState(true);
  useEffect(() => {
    setSettling(true);
    const t = setTimeout(() => setSettling(false), 700);
    return () => clearTimeout(t);
  }, [tab]);

  const go = (id) => {
    if (id === tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
    const idx = (x) => TABS.findIndex((t) => t.id === x);
    setEnter(Math.sign(idx(id) - idx(tabRef.current)));
    tabRef.current = id;
    setTab(id);
    window.scrollTo(0, 0);
    history.pushState(null, '', `#${id}`);
  };
  useEffect(() => {
    const onGo = (e) => go(e.detail);
    window.addEventListener('fit:go', onGo);
    return () => window.removeEventListener('fit:go', onGo);
  });

  // Swipe anywhere on a page to move between tabs.
  const tabIdx = TABS.findIndex((t) => t.id === tab);
  useSwipe(pager, {
    can: (dir) => !!TABS[tabIdx + dir],
    onSwipe: (dir) => TABS[tabIdx + dir] && go(TABS[tabIdx + dir].id),
  });

  const { View } = TABS.find((t) => t.id === tab);
  const syncLabel = {
    local: 'This device only',
    'signed-out': 'Not signed in',
    syncing: 'Syncing',
    synced: 'Synced',
    offline: 'Offline',
    error: 'Sync problem',
  }[sync.state];
  const live = sessions.some((x) => x.status === 'active');

  return (
    <div className={`app${settling ? ' settling' : ''}`}>
      <header className="topbar">
        <div className="brand" aria-label="fit+">
          <span aria-hidden="true">fit</span>
          <LogoMark color={s.logoColor || DEFAULT_LOGO} />
        </div>
        <div className="top-right">
          <button className="sync-btn" onClick={() => setSettings(true)} aria-label={`Settings. ${syncLabel}`}>
            <span className={`sync-dot s-${sync.state}`} aria-hidden="true" />
            <span className="sync-text">{syncLabel}</span>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {s.sample && (
        <div className="banner">
          <span>You’re looking at sample data.</span>
          <button className="mini" onClick={clearSample}>Clear it</button>
        </div>
      )}

      <div className="pager app-pager" ref={pager}>
        <main className={`view${enter ? (enter > 0 ? ' enter-next' : ' enter-prev') : ''}`} key={tab}>
          <View />
        </main>
      </div>

      <RestBar />

      <button className="fab" onClick={() => quickLog('protein')} aria-label="Log protein, weight or cardio">
        <Icon name="plus" size={28} />
      </button>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <Icon name={t.id} size={22} />
            {t.label}
            {t.id === 'train' && live && <i className="tab-live" aria-label="Workout in progress" />}
          </button>
        ))}
      </nav>

      {sheet && sheet.type === 'quick' && <QuickLog key={sheet.key} tab={sheet.preset} onClose={closeSheet} />}
      {sheet && sheet.type === 'session' && <SessionSheet key={sheet.key} id={sheet.id} sessions={sessions} onClose={closeSheet} />}
      {sheet && sheet.type === 'exercise' && <ExerciseSheet key={sheet.key} exId={sheet.id} onClose={closeSheet} />}
      {sheet && sheet.type === 'summary' && <SummarySheet key={sheet.key} result={sheet.preset} onClose={closeSheet} />}
      {sheet && sheet.type === 'vert' && <VertSheet key={sheet.key} onClose={closeSheet} />}
      <Suspense fallback={null}>{settings && <SettingsSheet onClose={() => setSettings(false)} />}</Suspense>
      <Toaster />
    </div>
  );
}

/** The rest timer, docked above the tab bar while it runs. */
function RestBar() {
  const r = useRest();
  if (!r) return null;
  return (
    <div className={`rest-bar${r.left <= 10 ? ' ending' : ''}`} role="timer" aria-live="off">
      <div className="rest-fill" style={{ transform: `scaleX(${Math.min(1, r.p)})` }} aria-hidden="true" />
      <div className="rest-main">
        <b className="rest-clock">{clock(r.left)}</b>
        <span className="rest-next">{r.next ? `Next: ${r.next}` : 'Rest'}</span>
      </div>
      <button className="mini" onClick={() => addRest(30)}>+30s</button>
      <button className="mini" onClick={stopRest} aria-label="Skip rest"><Icon name="skip" size={14} /></button>
    </div>
  );
}
