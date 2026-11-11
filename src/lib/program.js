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
   unit:   'reps' or 'm' (carries are logged in meters)
*/
export const EXERCISES = {
  boxjump: { name: 'Box jump', kind: 'jump', muscles: ['quads', 'glutes', 'calves'], cue: 'Max height; land soft, step down.' },
  broadjump: { name: 'Broad jump', kind: 'jump', muscles: ['quads', 'glutes', 'hamstrings'], cue: 'Stick the landing.' },
  cmj: { name: 'Countermovement jump', kind: 'jump', muscles: ['quads', 'glutes', 'calves'], cue: 'Arm swing, max height, reset each rep.' },

  trapbar: { name: 'Trap bar deadlift', kind: 'main', inc: 5, muscles: ['glutes', 'quads', 'hamstrings'], also: ['back', 'lowback'], lowBack: true, cue: 'Brace, chest up, stop if your back rounds.' },
  bench: { name: 'Bench press', kind: 'main', inc: 5, muscles: ['chest', 'triceps'], also: ['shoulders'], cue: 'Shoulder blades pinned, feet planted.' },
  frontsquat: { name: 'Front squat', kind: 'main', inc: 5, muscles: ['quads', 'glutes'], also: ['core', 'lowback'], lowBack: true, cue: 'Upright torso, elbows high.' },

  bss: { name: 'Bulgarian split squat', kind: 'acc', inc: 5, muscles: ['quads', 'glutes'], perSide: true, cue: 'Dumbbells; slight forward lean.' },
  pullup: { name: 'Pull-up', kind: 'acc', inc: 5, muscles: ['back', 'biceps'], bw: true, cue: 'Add weight once you hit 3 × 10.' },
  csrow: { name: 'Chest-supported row', kind: 'acc', inc: 5, muscles: ['back'], also: ['biceps'], cue: 'Squeeze shoulder blades at the top.' },
  pallof: { name: 'Pallof press', kind: 'acc', inc: 5, muscles: ['core'], perSide: true, cue: 'Anti-rotation: don’t let the cable turn you.' },

  hipthrust: { name: 'Barbell hip thrust', kind: 'acc', inc: 10, muscles: ['glutes'], also: ['hamstrings'], cue: 'Ribs down, no low-back arch at the top.' },
  dbrow: { name: 'One-arm dumbbell row', kind: 'acc', inc: 5, muscles: ['back'], also: ['biceps'], perSide: true, cue: 'Pull to the hip.' },
  legpress: { name: 'Leg press', kind: 'acc', inc: 10, muscles: ['quads', 'glutes'], cue: 'Feet high; stop before your hips tuck under.' },
  inclinedb: { name: 'Incline dumbbell press', kind: 'acc', inc: 5, muscles: ['chest', 'shoulders'], also: ['triceps'], cue: 'Low incline, control the bottom.' },
  hamcurl: { name: 'Hamstring curl', kind: 'acc', inc: 5, muscles: ['hamstrings'], cue: 'Slow lowering.' },
  calf: { name: 'Standing calf raise', kind: 'acc', inc: 10, muscles: ['calves'], cue: 'Pause at the bottom.' },

  slrdl: { name: 'Single-leg dumbbell RDL', kind: 'acc', inc: 5, muscles: ['hamstrings', 'glutes'], perSide: true, cue: 'Hips square, flat back.' },
  dbpress: { name: 'Seated dumbbell shoulder press', kind: 'acc', inc: 5, muscles: ['shoulders', 'triceps'], cue: 'Seated takes load off the low back.' },
  lateral: { name: 'Dumbbell lateral raise', kind: 'acc', inc: 5, muscles: ['shoulders'], cue: 'Lead with the elbows.' },
  pushdown: { name: 'Cable triceps pushdown', kind: 'acc', inc: 5, muscles: ['triceps'], cue: 'Elbows pinned.' },
  curl: { name: 'Dumbbell curl', kind: 'acc', inc: 5, muscles: ['biceps'], cue: 'No swinging.' },
  carry: { name: 'Suitcase carry', kind: 'acc', inc: 5, muscles: ['core'], perSide: true, unit: 'm', cue: 'Stay tall; don’t lean.' },

  // Alternatives (picked in Plan, or used automatically when your low back is sore).
  latpulldown: { name: 'Lat pulldown', kind: 'acc', inc: 10, muscles: ['back', 'biceps'], cue: 'Pull to the top of the chest.' },
  ssbsquat: { name: 'Safety squat bar squat', kind: 'main', inc: 5, muscles: ['quads', 'glutes'], also: ['core', 'lowback'], lowBack: true, cue: 'Brace hard, sit between your hips.' },
  splitsquat: { name: 'Dumbbell split squat', kind: 'acc', inc: 5, muscles: ['quads', 'glutes'], perSide: true, cue: 'Back-friendly stand-in for the squat.' },
  seatedcurl: { name: 'Seated hamstring curl', kind: 'acc', inc: 5, muscles: ['hamstrings'], cue: 'Slow lowering.' },
  dbbench: { name: 'Dumbbell bench press', kind: 'main', inc: 5, muscles: ['chest', 'triceps'], also: ['shoulders'], cue: 'Control the bottom.' },
  hexrow: { name: 'Cable row', kind: 'acc', inc: 10, muscles: ['back'], also: ['biceps'], cue: 'Tall chest, elbows back.' },
  smithcalf: { name: 'Seated calf raise', kind: 'acc', inc: 10, muscles: ['calves'], cue: 'Pause at the bottom.' },
};
export const exName = (id) => (EXERCISES[id] || { name: id }).name;

/** Swaps you can pick in Plan for each exercise in the program. */
export const ALTERNATIVES = {
  pullup: ['latpulldown'],
  csrow: ['hexrow', 'dbrow'],
  frontsquat: ['ssbsquat', 'splitsquat'],
  bench: ['dbbench'],
  hamcurl: ['seatedcurl'],
  calf: ['smithcalf'],
  dbrow: ['hexrow', 'csrow'],
  legpress: ['splitsquat'],
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
      { ex: 'boxjump', sets: 4, lo: 3, hi: 3, rest: 90 },
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
      { ex: 'bench', main: true, rest: 210 },
      { ex: 'hipthrust', sets: 3, lo: 8, hi: 12, rest: 90, ss: 'A' },
      { ex: 'dbrow', sets: 3, lo: 10, hi: 12, rest: 90, ss: 'A' },
      { ex: 'legpress', sets: 3, lo: 10, hi: 15, rest: 90, ss: 'B' },
      { ex: 'inclinedb', sets: 3, lo: 8, hi: 12, rest: 90, ss: 'B' },
      { ex: 'hamcurl', sets: 3, lo: 8, hi: 12, rest: 60, ss: 'C' },
      { ex: 'calf', sets: 3, lo: 12, hi: 15, rest: 60, ss: 'C' },
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
  0: { name: 'Baseline', note: 'Test your vertical: standing reach, then best of 3 jumps. Video it.', main: [4, 5] },
  1: { name: 'Build', note: 'Main lifts 4 × 5. Add ~5 lb a week when every rep feels like 2+ in the tank.', main: [4, 5] },
  2: { name: 'Build', note: 'Main lifts 4 × 5.', main: [4, 5] },
  3: { name: 'Build', note: 'Main lifts 4 × 5. Last build week before the deload.', main: [4, 5] },
  4: { name: 'Deload', note: 'Half the sets, same weights; jumps 2 × 3.', main: [4, 5], deload: true },
  5: { name: 'Strength', note: 'Main lifts 5 × 3, heavier. Hypertrophy work unchanged.', main: [5, 3] },
  6: { name: 'Strength', note: 'Main lifts 5 × 3.', main: [5, 3] },
  7: { name: 'Strength', note: 'Main lifts 5 × 3. Heaviest week.', main: [5, 3] },
  8: { name: 'Deload + test', note: 'Half the sets; retest your vertical at the end of the week.', main: [5, 3], deload: true, test: true },
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
