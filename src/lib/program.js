// Ethan's 8-Week Galpin Program, written as data. The engine (engine.js) turns this plus your logs
// into each day's workout: which exercises, how many sets, what weight, how many reps, how long to rest.

/* ---------- Muscle groups (what you rate for soreness and what weekly sets count toward) ---------- */
export const MUSCLES = [
  { id: 'quads', name: 'Quads', legs: true },
  { id: 'hamstrings', name: 'Hamstrings', legs: true },
  { id: 'glutes', name: 'Glutes', legs: true },
  { id: 'calves', name: 'Calves', legs: true },
  { id: 'lowback', name: 'Low back' },
  { id: 'back', name: 'Back' },
  { id: 'chest', name: 'Chest' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'biceps', name: 'Biceps' },
  { id: 'triceps', name: 'Triceps' },
  { id: 'core', name: 'Core' },
];
export const muscleName = (id) => (MUSCLES.find((m) => m.id === id) || { name: id }).name;
export const LEG_MUSCLES = MUSCLES.filter((m) => m.legs).map((m) => m.id);

/* ---------- Exercises ----------
   kind:   'jump' (power: no weight, never grind), 'main' (the day's heavy lift, 3-5 rule),
           'acc' (hypertrophy: double progression through the rep range)
   inc:    lb added when it's time to go up (5 for dumbbells and barbells, 10 for machines)
   muscles: primary muscles (count as a full set each); also: secondary (half a set)
   lowBack: loads the spine enough that a sore low back changes it
   bw:     bodyweight movement; the weight you log is extra weight added (0 to start)
   assist: the weight you log is help (an assisted machine or band); progress means taking help away
   unit:   'reps' or 'm' (carries are logged in meters)
   measure: what a jump logs (default 'Height'; 'Distance' for broad jumps and bounds)
   gym:     needs rec-center equipment (or, for jumps, a high ceiling): not offered at home
   homeOnly: the home machine's version: not offered at the gym
   jumpW:   a jump done holding weight: logs the weight, no height (noMeasure)
*/
export const EXERCISES = {
  boxjump: { name: 'Box jump', gym: true, kind: 'jump', muscles: ['quads', 'glutes', 'calves'], cue: 'Max height; land soft, step down.' },
  broadjump: { name: 'Broad jump', kind: 'jump', measure: 'Distance', muscles: ['quads', 'glutes', 'hamstrings'], cue: 'Stick the landing.' },
  cmj: { name: 'Countermovement jump', gym: true, kind: 'jump', muscles: ['quads', 'glutes', 'calves'], cue: 'Arm swing, max height, reset each rep.' },
  slapproach: { name: 'Single-leg approach jump', gym: true, kind: 'jump', perSide: true, muscles: ['quads', 'glutes', 'calves'], cue: '2–3 step approach, take off one leg, touch as high as you can. Log touch height minus standing reach.' },
  bound: { name: 'Single-leg bound', kind: 'jump', perSide: true, measure: 'Distance', muscles: ['glutes', 'hamstrings', 'calves'], cue: 'Hop forward off one leg, sharp takeoff, stick each landing.' },

  trapbar: { name: 'Trap bar deadlift', gym: true, kind: 'main', inc: 5, muscles: ['glutes', 'quads', 'hamstrings'], also: ['back', 'lowback'], lowBack: true, cue: 'Brace, chest up, stop if your back rounds.' },
  bench: { name: 'Bench press', gym: true, kind: 'main', inc: 5, muscles: ['chest', 'triceps'], also: ['shoulders'], cue: 'Shoulder blades pinned, feet planted.' },
  frontsquat: { name: 'Front squat', gym: true, kind: 'main', inc: 5, muscles: ['quads', 'glutes'], also: ['core', 'lowback'], lowBack: true, cue: 'Upright torso, elbows high.' },

  bss: { name: 'Bulgarian split squat', kind: 'acc', inc: 5, muscles: ['quads', 'glutes'], perSide: true, cue: 'Dumbbells; slight forward lean.' },
  pullup: { name: 'Pull-up', gym: true, kind: 'acc', inc: 5, muscles: ['back', 'biceps'], bw: true, cue: 'Add weight once you hit 3 × 10.' },
  csrow: { name: 'Chest-supported row', gym: true, kind: 'acc', inc: 5, muscles: ['back'], also: ['biceps'], cue: 'Squeeze shoulder blades at the top.' },
  pallof: { name: 'Pallof press', gym: true, kind: 'acc', inc: 5, muscles: ['core'], perSide: true, cue: 'Anti-rotation: don’t let the cable turn you.' },

  hipthrust: { name: 'Barbell hip thrust', gym: true, kind: 'acc', inc: 10, muscles: ['glutes'], also: ['hamstrings'], cue: 'Ribs down, no low-back arch at the top.' },
  dbrow: { name: 'One-arm dumbbell row', kind: 'acc', inc: 5, muscles: ['back'], also: ['biceps'], perSide: true, cue: 'Pull to the hip.' },
  legpress: { name: 'Leg press', gym: true, kind: 'acc', inc: 10, muscles: ['quads', 'glutes'], cue: 'Feet high; stop before your hips tuck under.' },
  inclinedb: { name: 'Incline dumbbell press', kind: 'acc', inc: 5, muscles: ['chest', 'shoulders'], also: ['triceps'], cue: 'Low incline, control the bottom.' },
  hamcurl: { name: 'Hamstring curl', gym: true, kind: 'acc', inc: 5, muscles: ['hamstrings'], cue: 'Slow lowering.' },
  slcalf: { name: 'Single-leg calf raise', kind: 'acc', inc: 5, muscles: ['calves'], perSide: true, cue: 'Hold a dumbbell, full stretch at the bottom, pause.' },
  calf: { name: 'Standing calf raise', gym: true, kind: 'acc', inc: 10, muscles: ['calves'], cue: 'Pause at the bottom.' },

  slrdl: { name: 'Single-leg dumbbell RDL', kind: 'acc', inc: 5, muscles: ['hamstrings', 'glutes'], perSide: true, cue: 'Hips square, flat back.' },
  dbpress: { name: 'Seated dumbbell shoulder press', kind: 'acc', inc: 5, muscles: ['shoulders', 'triceps'], cue: 'Seated takes load off the low back.' },
  lateral: { name: 'Dumbbell lateral raise', kind: 'acc', inc: 5, muscles: ['shoulders'], cue: 'Lead with the elbows.' },
  pushdown: { name: 'Cable triceps pushdown', gym: true, kind: 'acc', inc: 5, muscles: ['triceps'], cue: 'Elbows pinned.' },
  curl: { name: 'Dumbbell curl', kind: 'acc', inc: 5, muscles: ['biceps'], cue: 'No swinging.' },
  carry: { name: 'Suitcase carry', kind: 'acc', inc: 5, muscles: ['core'], perSide: true, unit: 'm', cue: 'Stay tall; don’t lean.' },

  // Alternatives (picked in Plan, or used automatically when your low back is sore).
  assistpullup: { name: 'Assisted pull-up', gym: true, kind: 'acc', inc: 10, assist: true, muscles: ['back', 'biceps'], cue: 'Machine or band. The weight is how much help you get: less help is harder.' },
  latpulldown: { name: 'Lat pulldown', gym: true, kind: 'acc', inc: 10, muscles: ['back', 'biceps'], cue: 'Pull to the top of the chest.' },
  ssbsquat: { name: 'Safety squat bar squat', gym: true, kind: 'main', inc: 5, muscles: ['quads', 'glutes'], also: ['core', 'lowback'], lowBack: true, cue: 'Brace hard, sit between your hips.' },
  splitsquat: { name: 'Dumbbell split squat', kind: 'acc', inc: 5, muscles: ['quads', 'glutes'], perSide: true, cue: 'Back-friendly stand-in for the squat.' },
  seatedcurl: { name: 'Seated hamstring curl', gym: true, kind: 'acc', inc: 5, muscles: ['hamstrings'], cue: 'Slow lowering.' },
  dbbench: { name: 'Dumbbell bench press', kind: 'main', inc: 5, muscles: ['chest', 'triceps'], also: ['shoulders'], cue: 'Control the bottom.' },
  hexrow: { name: 'Cable row', gym: true, kind: 'acc', inc: 10, muscles: ['back'], also: ['biceps'], cue: 'Tall chest, elbows back.' },
  smithcalf: { name: 'Seated calf raise', gym: true, kind: 'acc', inc: 10, muscles: ['calves'], cue: 'Pause at the bottom.' },

  // Home gym (Body-Solid cable machine, dumbbells, adjustable bench, plyo box, stability balls, TRX).
  // Machine moves get their own ids so the home stack's weights never mix with the rec center's.
  latbound: { name: 'Lateral bound', kind: 'jump', perSide: true, measure: 'Distance', muscles: ['glutes', 'quads', 'calves'], cue: 'Push off sideways off one leg, stick the landing on the other. Low ceiling: jump out, not up.' },
  kneelbroad: { name: 'Kneeling broad jump', kind: 'jump', measure: 'Distance', muscles: ['glutes', 'hamstrings', 'quads'], cue: 'Start tall on your knees, swing the arms, snap the hips and jump forward to your feet. Stick the landing.' },
  wboxjump: { name: 'Weighted box jump (16")', kind: 'jump', jumpW: true, noMeasure: true, inc: 5, muscles: ['quads', 'glutes', 'calves'], cue: 'Light dumbbells or a vest on the 16" plyo box. Explode up, land soft and quiet, step down. Fast every rep: if the jump slows, drop the weight.' },
  dropbroad: { name: 'Drop to broad jump', kind: 'jump', measure: 'Distance', muscles: ['quads', 'glutes', 'hamstrings'], cue: 'Step (don’t jump) off the plyo box, land on both feet and bounce straight into a broad jump. Short ground contact, stick the landing.' },
  depthdrop: { name: 'Depth drop', kind: 'jump', measure: 'Box height', muscles: ['quads', 'glutes', 'calves'], cue: 'Step off the plyo box, land quietly in an athletic stance and freeze. Teaches your legs to absorb force.' },
  skater: { name: 'Skater hop', kind: 'jump', perSide: true, measure: 'Distance', muscles: ['glutes', 'quads', 'calves'], cue: 'Side to side off one leg, quick off the ground, land soft on the other. Low and wide, not high.' },
  dbrdl: { name: 'Dumbbell Romanian deadlift', kind: 'acc', inc: 5, muscles: ['hamstrings', 'glutes'], also: ['lowback'], lowBack: true, cue: 'Stand-in for the trap bar. Heavy dumbbells, hips back, flat back, stop at mid-shin.' },
  gobletsquat: { name: 'Goblet squat', kind: 'acc', inc: 5, muscles: ['quads', 'glutes'], also: ['core'], cue: 'Heaviest dumbbell held at your chest, sit down between your hips, slow on the way down.' },
  dbhipthrust: { name: 'Dumbbell hip thrust', kind: 'acc', inc: 5, muscles: ['glutes'], also: ['hamstrings'], cue: 'Upper back on the bench, dumbbell on your hips. Ribs down, pause at the top.' },
  ballcurl: { name: 'Stability ball hamstring curl', kind: 'acc', inc: 5, bw: true, muscles: ['hamstrings'], cue: 'Heels on the ball, hips up, curl in, slow out. Go single-leg once 3 × 12 is easy.' },
  homepulldown: { name: 'Lat pulldown (home machine)', homeOnly: true, kind: 'acc', inc: 10, muscles: ['back', 'biceps'], cue: 'Top pulley on the Body-Solid. Pull to the top of the chest.' },
  inclinerow: { name: 'Chest-supported dumbbell row', kind: 'acc', inc: 5, muscles: ['back'], also: ['biceps'], cue: 'Chest down on the bench set to an incline. Squeeze shoulder blades at the top.' },
  homepallof: { name: 'Pallof press (home machine)', homeOnly: true, kind: 'acc', inc: 5, muscles: ['core'], perSide: true, cue: 'Middle or low pulley on the Body-Solid. Don’t let the cable turn you.' },
  homepushdown: { name: 'Triceps pushdown (home machine)', homeOnly: true, kind: 'acc', inc: 5, muscles: ['triceps'], cue: 'Top pulley on the Body-Solid. Elbows pinned.' },
  // Extra options for swapping mid-workout (see swapOptions).
  pushup: { name: 'Push-up', kind: 'acc', inc: 5, bw: true, muscles: ['chest', 'triceps'], also: ['shoulders', 'core'], cue: 'Body in one line, chest to an inch off the floor. Add a weight vest or plate once 3 × 15 is easy.' },
  dbfly: { name: 'Dumbbell fly', kind: 'acc', inc: 5, muscles: ['chest'], cue: 'Flat or low incline, soft elbows, deep stretch, squeeze up.' },
  cablefly: { name: 'Cable fly', kind: 'acc', inc: 5, gym: true, muscles: ['chest'], cue: 'Step forward, slight lean, hug a big tree.' },
  trxrow: { name: 'TRX row', kind: 'acc', inc: 5, bw: true, muscles: ['back'], also: ['biceps'], cue: 'Body straight, pull hands to ribs. Walk your feet forward to make it harder.' },
  rearfly: { name: 'Rear delt fly', kind: 'acc', inc: 5, muscles: ['shoulders'], also: ['back'], cue: 'Chest on an incline bench or hinge over, light dumbbells, lead with the pinkies.' },
  revlunge: { name: 'Dumbbell reverse lunge', kind: 'acc', inc: 5, perSide: true, muscles: ['quads', 'glutes'], cue: 'Step back, back knee kisses the floor, drive through the front heel.' },
  legext: { name: 'Leg extension', kind: 'acc', inc: 10, gym: true, muscles: ['quads'], cue: 'Pause at the top, slow lowering.' },
  slbridge: { name: 'Single-leg glute bridge', kind: 'acc', inc: 5, bw: true, perSide: true, muscles: ['glutes'], also: ['hamstrings'], cue: 'Shoulders on the floor or bench, other knee pulled in, pause at the top.' },
  hammercurl: { name: 'Hammer curl', kind: 'acc', inc: 5, muscles: ['biceps'], cue: 'Thumbs up, elbows pinned.' },
  ohtri: { name: 'Overhead dumbbell triceps extension', kind: 'acc', inc: 5, muscles: ['triceps'], cue: 'One dumbbell in both hands, elbows in, deep stretch behind the head.' },
  deadbug: { name: 'Dead bug', kind: 'acc', inc: 5, bw: true, perSide: true, muscles: ['core'], cue: 'Low back pressed into the floor the whole time, slow reach.' },
  stepup: { name: 'Box step-up', kind: 'acc', inc: 5, perSide: true, muscles: ['quads', 'glutes'], cue: 'Dumbbells, whole foot on the plyo box, drive through that heel; don’t push off the back foot. Mind your head under a low ceiling.' },
  dbcalf: { name: 'Dumbbell calf raise', kind: 'acc', inc: 5, muscles: ['calves'], cue: 'Balls of the feet on a plate or step, full stretch, pause at the bottom.' },
};
export const exName = (id) => (EXERCISES[id] || { name: id }).name;

/**
 * What can stand in for an exercise mid-workout.
 *   exId:    the exercise being replaced
 *   muscles: muscle ids to match (default: the exercise's own main muscles)
 *   home:    lifting at home (drops gym-only moves) or at the gym (drops home-machine moves)
 * Jumps only trade for jumps, lifts only for lifts. Best match first: hits the same main muscles,
 * (the first one most), then also works them as a secondary muscle, then the same kind (main lift vs
 * hypertrophy), with focused moves ahead of ones that spread across other muscles.
 */
export function swapOptions(exId, { muscles, home = false } = {}) {
  const cur = EXERCISES[exId];
  if (!cur) return [];
  const want = muscles && muscles.length ? muscles : cur.muscles;
  const jump = cur.kind === 'jump';
  return Object.entries(EXERCISES)
    .filter(([id, ex]) => id !== exId && (ex.kind === 'jump') === jump && (home ? !ex.gym : !ex.homeOnly))
    .map(([id, ex]) => {
      const main = ex.muscles.filter((m) => want.includes(m)).length;
      const also = (ex.also || []).filter((m) => want.includes(m)).length;
      const lead = ex.muscles.includes(want[0]) ? 2 : 0; // the first muscle is what it's mostly for
      const extra = (ex.muscles.length - main) * 0.25; // focused moves before ones that spread out
      return { id, ex, main, score: main * 4 + lead + also + (ex.kind === cur.kind ? 0.5 : 0) - extra };
    })
    .filter((o) => (jump ? true : o.main > 0))
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
    .map((o) => o.id);
}

/** Swaps you can pick in Plan for each exercise in the program. */
export const ALTERNATIVES = {
  pullup: ['assistpullup', 'latpulldown'],
  csrow: ['hexrow', 'dbrow'],
  frontsquat: ['ssbsquat', 'splitsquat'],
  bench: ['dbbench'],
  hamcurl: ['seatedcurl'],
  calf: ['smithcalf'],
  slcalf: ['calf', 'smithcalf'],
  dbrow: ['hexrow', 'csrow'],
  legpress: ['splitsquat'],
};

/** The at-home version of each exercise in the program. Anything not listed is done as written.
    Gym swaps from Plan don't apply at home. The ceiling is 9 ft, too low for tall box jumps or
    max-height jumps, so jumps go onto the 16" plyo box, forward or sideways, a different kind each day
    (Day 1 weighted 16" box jump + lateral bound, Day 2 broad jump + single-leg bound as written, Day 3 skater hops), and the main slot uses a dumbbell stand-in (3 × 6–8). */
export const HOME = {
  // Day 1
  boxjump: 'wboxjump',
  slapproach: 'latbound',
  trapbar: 'dbrdl',
  pullup: 'homepulldown',
  csrow: 'inclinerow',
  pallof: 'homepallof',
  // Day 2
  bench: 'dbbench',
  hipthrust: 'dbhipthrust',
  legpress: 'gobletsquat',
  hamcurl: 'ballcurl',
  // Day 3
  cmj: 'skater',
  frontsquat: 'gobletsquat',
  pushdown: 'homepushdown',
};

/* ---------- The three lift days ----------
   sets:  normal working sets; main lifts take their sets and reps from the week (see PHASES)
   lo/hi: rep range; rest in seconds; ss: superset letter shared by a pair
*/
export const DAYS = {
  d1: {
    name: 'Lower power & strength + pull',
    short: 'Lower + pull',
    slots: [
      { ex: 'boxjump', sets: 3, lo: 3, hi: 3, rest: 90 },
      { ex: 'slapproach', sets: 3, lo: 3, hi: 3, rest: 60 },
      { ex: 'trapbar', main: true, rest: 210 },
      { ex: 'bss', sets: 3, lo: 6, hi: 8, rest: 120 },
      { ex: 'pullup', sets: 3, lo: 6, hi: 10, rest: 90, ss: 'A' },
      { ex: 'csrow', sets: 3, lo: 8, hi: 12, rest: 90, ss: 'A' },
      { ex: 'pallof', sets: 3, lo: 10, hi: 10, rest: 60 },
    ],
  },
  d2: {
    name: 'Upper strength + lower hypertrophy',
    short: 'Upper + legs',
    slots: [
      { ex: 'broadjump', sets: 3, lo: 3, hi: 3, rest: 90 },
      { ex: 'bound', sets: 3, lo: 4, hi: 4, rest: 60 },
      { ex: 'bench', main: true, rest: 210 },
      { ex: 'hipthrust', sets: 3, lo: 8, hi: 12, rest: 90, ss: 'A' },
      { ex: 'dbrow', sets: 3, lo: 10, hi: 12, rest: 90, ss: 'A' },
      { ex: 'legpress', sets: 3, lo: 10, hi: 15, rest: 90, ss: 'B' },
      { ex: 'inclinedb', sets: 3, lo: 8, hi: 12, rest: 90, ss: 'B' },
      { ex: 'hamcurl', sets: 3, lo: 8, hi: 12, rest: 60, ss: 'C' },
      { ex: 'slcalf', sets: 3, lo: 10, hi: 12, rest: 60, ss: 'C' },
    ],
  },
  d3: {
    name: 'Full-body power + hypertrophy',
    short: 'Full body',
    slots: [
      { ex: 'cmj', sets: 4, lo: 3, hi: 3, rest: 90 },
      { ex: 'frontsquat', main: true, rest: 180 },
      { ex: 'slrdl', sets: 3, lo: 8, hi: 8, rest: 90 },
      { ex: 'dbpress', sets: 3, lo: 6, hi: 10, rest: 120 },
      { ex: 'lateral', sets: 3, lo: 12, hi: 20, rest: 60, ss: 'A' },
      { ex: 'pushdown', sets: 3, lo: 10, hi: 15, rest: 60, ss: 'A' },
      { ex: 'curl', sets: 3, lo: 10, hi: 15, rest: 60, ss: 'B' },
      { ex: 'carry', sets: 3, lo: 30, hi: 30, rest: 60, ss: 'B' },
    ],
  },
};
export const DAY_IDS = ['d1', 'd2', 'd3'];
export const dayLabel = (id) => `Day ${id.slice(1)}`;

/* ---------- The 8 weeks ----------
   Week 0 is the baseline week before week 1 (vertical test). After week 8 the block repeats.
*/
export const PHASES = {
  0: { name: 'Baseline', note: 'Test your vertical before Day 1, right after the normal warm-up: standing reach, then best of 3 jumps. Video it. Note your leg soreness, and test the same way every time.', main: [4, 5] },
  1: { name: 'Build', note: 'Main lifts 4 × 5. Add ~5 lb a week when every rep feels like 2+ in the tank.', main: [4, 5] },
  2: { name: 'Build', note: 'Main lifts 4 × 5.', main: [4, 5] },
  3: { name: 'Build', note: 'Main lifts 4 × 5. Last build week before the deload.', main: [4, 5] },
  4: { name: 'Deload', note: 'Half the sets, same weights; jumps 2 × 3.', main: [4, 5], deload: true },
  5: { name: 'Strength', note: 'Main lifts 5 × 3, heavier. Hypertrophy work unchanged.', main: [5, 3] },
  6: { name: 'Strength', note: 'Main lifts 5 × 3.', main: [5, 3] },
  7: { name: 'Strength', note: 'Main lifts 5 × 3. Heaviest week.', main: [5, 3] },
  8: { name: 'Deload + test', note: 'Half the sets; retest your vertical at the end of the week, same warm-up and setup as your baseline.', main: [5, 3], deload: true, test: true },
};

export const WARMUP = [
  { id: 'w1', text: 'Easy bike or jog', detail: '3 min' },
  { id: 'w2', text: 'McGill curl-up', detail: '3 × 8-sec holds' },
  { id: 'w3', text: 'Side plank', detail: '3 × 10 sec per side' },
  { id: 'w4', text: 'Bird dog', detail: '2 × 6 per side, 5-sec hold' },
  { id: 'w5', text: 'Hip 90/90 switches', detail: '10 total' },
  { id: 'w6', text: 'Glute bridge', detail: '10 reps' },
  { id: 'w7', text: 'Pogo hops', detail: '2 × 10' },
  { id: 'w8', text: 'Two light sets of the main lift', detail: 'Ramp up' },
];

export const BACK_RULES = [
  'Brace before every heavy rep: big breath into your belly, tighten like you’re about to be poked.',
  'End the set the moment your lower back rounds or arches, even mid-set.',
  'Up to 3/10 back discomfort that settles by the next day is OK. Above that, drop the load or swap to the single-leg option.',
  'Pain that’s sharp, lingers, or runs down a leg means stop and see a physical therapist.',
];

export const CARDIO_TYPES = [
  { id: 'zone2', name: 'Zone 2', hint: 'Walk, incline walk or easy jog', hard: false },
  { id: 'bball', name: 'Basketball', hint: 'Counts as the hard session', hard: true },
  { id: 'intervals', name: '4 × 4 intervals', hint: 'Hard session when there’s no game', hard: true },
  { id: 'walk', name: 'Easy walk', hint: 'Long, easy; counts toward zone 2', hard: false, z2: true },
];
export const cardioName = (id) => (CARDIO_TYPES.find((c) => c.id === id) || { name: id }).name;
