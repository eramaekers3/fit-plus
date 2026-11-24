// Warm-ups and stretch routines you can pick, plus the adaptive builder.
//
// Two kinds of routine:
//   warm     dynamic moves to get ready for something (lift day, basketball, a run, jumps)
//   stretch  holds to recover (after something, or for a spot that's sore or tight)
//
// Presets are hand-built for an activity or for a sore/tight area. The adaptive builder takes the
// same 0-3 soreness ratings as the body check, plus tightness, and builds a routine that still
// covers what you always need (a pulse raiser and the McGill big 3 before lifting; hamstrings, hips
// and low back after), then spends the rest of the time on what you rated.
//
// Sore vs tight: soreness gets blood flow and easy range of motion (gentle, no pushing, holds a
// little shorter). Tightness gets more time and longer holds. Very sore legs drop the hard jumping.
//
// Everything stays back-friendly: no standing toe-touches or loaded spinal flexion, and hamstrings
// are stretched lying down.
import { put } from '../store.js';
import { newId } from './ids.js';
import { todayISO } from './dates.js';
import { STRETCHES, MUSCLES, stretchSecs, markStretched } from './stretch.js';

export { MUSCLES, stretchSecs };

/* ---------- Warm-up moves ----------
   phase:  0 raise the heart rate, 1 floor (core and glutes, the McGill big 3), 2 mobility,
           3 dynamic on your feet, 4 power (jumps and sprints, last).
   reps:   what to aim for in the time (shown under the timer).
   covers: the matching line in the lift-day warm-up checklist (program.js WARMUP).
   power:  hard on tired legs; left out when legs are very sore.
   mob:    a mobility move (tightness gets extra time on these). */
export const MOVES = [
  { id: 'bike', name: 'Easy bike or jog', phase: 0, secs: 180, covers: 'w1', t: { quads: 0.5, calves: 0.5, hips: 0.3 },
    cue: 'Easy pace, nose breathing. You should be warm and just starting to sweat by the end.' },
  { id: 'rope', name: 'Easy jump rope or skips', phase: 0, secs: 90, covers: 'w1', t: { calves: 1, shoulders: 0.2 },
    cue: 'Light and quiet on the balls of your feet. No rope? Skip in place.' },
  { id: 'march', name: 'High-knee march', phase: 0, secs: 45, gentle: true, t: { hips: 0.8, glutes: 0.3, core: 0.3 },
    cue: 'Knee to hip height, tall posture, opposite arm swings. Slow and controlled.' },

  { id: 'curlup', name: 'McGill curl-up', phase: 1, secs: 45, reps: '3 × 8-sec holds', covers: 'w2', gentle: true, t: { core: 1, lowback: 0.3 },
    cue: 'One knee bent, hands under your low back. Lift head and shoulders an inch as one piece and hold. Switch the bent leg halfway.' },
  { id: 'sideplank', name: 'Side plank', phase: 1, sides: true, secs: 30, reps: '3 × 10 sec', covers: 'w3', t: { core: 1, lowback: 0.4, glutes: 0.3 },
    cue: 'Elbow under shoulder, knees or feet stacked. Straight line head to knees. Short holds, full tension.' },
  { id: 'birddog', name: 'Bird dog', phase: 1, sides: true, secs: 40, reps: '6 reps, 5-sec holds', covers: 'w4', gentle: true, t: { core: 0.7, lowback: 0.7, glutes: 0.5, back: 0.3 },
    cue: 'On all fours, reach the opposite arm and leg long. Hips stay level. Make a fist and squeeze, then sweep back in.' },
  { id: 'deadbug', name: 'Dead bug', phase: 1, secs: 40, reps: '8 per side', gentle: true, t: { core: 1, hips: 0.3 },
    cue: 'Low back pressed into the floor the whole time. Lower the opposite arm and leg slowly, breathe out as they go.' },
  { id: 'catcow', name: 'Cat-cow', phase: 1, secs: 30, gentle: true, mob: true, t: { lowback: 0.8, back: 0.4 },
    cue: 'Slow, about 4 seconds each way. Move one vertebra at a time.' },
  { id: 'bridge', name: 'Glute bridge', phase: 1, secs: 40, reps: '10 reps, 2-sec squeeze', covers: 'w6', gentle: true, t: { glutes: 1, hamstrings: 0.4, hips: 0.3 },
    cue: 'Ribs down, push through your heels, squeeze glutes at the top. Don’t arch to get higher.' },
  { id: 'clam', name: 'Side-lying clamshell', phase: 1, sides: true, secs: 30, reps: '12 reps', gentle: true, t: { glutes: 0.8, hips: 0.3 },
    cue: 'Heels together, open the top knee without rolling your hips back. Add a band if it’s easy.' },
  { id: 'ninety', name: 'Hip 90/90 switches', phase: 1, secs: 45, reps: '10 total', covers: 'w5', gentle: true, mob: true, t: { hips: 1, glutes: 0.6, adductors: 0.5 },
    cue: 'Sit with both knees at 90°. Windshield-wiper your knees to the other side. Hands behind you if you need them.' },
  { id: 'adrock', name: 'Adductor rock-back', phase: 1, sides: true, secs: 30, reps: '8 slow rocks', gentle: true, mob: true, t: { adductors: 1, hips: 0.4 },
    cue: 'On all fours, one leg straight out to the side. Rock your hips back toward your heel and forward again.' },
  { id: 'thread', name: 'Thread the needle', phase: 1, sides: true, secs: 30, reps: '6 slow reps', gentle: true, mob: true, t: { back: 0.8, shoulders: 0.5 },
    cue: 'On all fours, slide one arm under your body and rotate, then open it up to the ceiling. Follow your hand with your eyes.' },

  { id: 'wgs', name: 'World’s greatest stretch', phase: 2, sides: true, secs: 40, reps: '4 slow reps', mob: true, t: { hips: 1, hamstrings: 0.5, back: 0.4, adductors: 0.3 },
    cue: 'Long lunge, back knee down if needed. Elbow toward the front instep, rotate that arm to the ceiling, then straighten the front leg a little.' },
  { id: 'legf', name: 'Leg swings, front to back', phase: 2, sides: true, secs: 25, reps: '12 swings', gentle: true, mob: true, t: { hamstrings: 0.8, hips: 0.8 },
    cue: 'Hold a wall. Swing loose and relaxed, a bit higher each rep. Keep your torso tall.' },
  { id: 'legs', name: 'Leg swings, side to side', phase: 2, sides: true, secs: 25, reps: '12 swings', gentle: true, mob: true, t: { adductors: 1, hips: 0.5 },
    cue: 'Face the wall, swing across your body and out. Stay relaxed.' },
  { id: 'ankle', name: 'Knee-to-wall ankle rocks', phase: 2, sides: true, secs: 25, reps: '10 rocks', gentle: true, mob: true, t: { calves: 1 },
    cue: 'Foot a hand-width from the wall, drive your knee over your toes to touch it. Heel stays down.' },
  { id: 'armc', name: 'Arm circles', phase: 2, secs: 30, reps: '10 each way', gentle: true, mob: true, t: { shoulders: 1, chest: 0.3 },
    cue: 'Small to big, forward then back. Keep your shoulders down.' },
  { id: 'pullapart', name: 'Band pull-aparts', phase: 2, secs: 40, reps: '15 reps', gentle: true, t: { back: 0.8, shoulders: 0.7 },
    cue: 'Arms straight at shoulder height, pull the band to your chest by squeezing your shoulder blades.' },
  { id: 'wallslide', name: 'Wall slides', phase: 2, secs: 40, reps: '8 slow reps', gentle: true, mob: true, t: { shoulders: 0.8, back: 0.5, chest: 0.3 },
    cue: 'Back and forearms on the wall, slide up into a Y and back down. Ribs stay down.' },
  { id: 'pushup', name: 'Easy push-ups', phase: 2, secs: 30, reps: '8–10 reps', t: { chest: 1, triceps: 0.5, shoulders: 0.4 },
    cue: 'Smooth tempo, nowhere near failure. Hands on a bench if you’re sore.' },
  { id: 'squat', name: 'Slow bodyweight squats', phase: 2, secs: 40, reps: '8 reps, 2-sec pause', gentle: true, t: { quads: 0.8, glutes: 0.6, adductors: 0.4, hips: 0.3 },
    cue: 'Sit between your heels, chest up, pause at the bottom and push your knees out with your elbows.' },

  { id: 'lunge', name: 'Walking lunge with reach', phase: 3, sides: true, secs: 30, reps: '5 per side', t: { quads: 0.8, hips: 1, glutes: 0.5 },
    cue: 'Long step, back knee kisses the floor, reach both arms up and lean slightly away from the front leg.' },
  { id: 'scoop', name: 'Hamstring scoops', phase: 3, secs: 30, reps: '10 walking', gentle: true, mob: true, t: { hamstrings: 1, calves: 0.3 },
    cue: 'Heel out, toes up, sweep both hands low past the front foot as you walk. Flat back, hinge at the hips.' },
  { id: 'kick', name: 'Butt kicks', phase: 3, secs: 25, t: { quads: 0.8 }, cue: 'Quick, light steps. Heels up toward your glutes.' },
  { id: 'askip', name: 'A-skips', phase: 3, secs: 30, reps: '2 × 15 m', t: { calves: 0.8, hips: 0.7, quads: 0.3 },
    cue: 'Drive the knee up, snap the foot down under your hip. Rhythm over height.' },
  { id: 'shuffle', name: 'Lateral shuffles', phase: 3, secs: 30, reps: '2 each way', t: { adductors: 0.7, hips: 0.5, calves: 0.5 },
    cue: 'Low and athletic, don’t click your heels together.' },
  { id: 'carioca', name: 'Carioca', phase: 3, secs: 30, reps: '2 each way', t: { hips: 0.8, adductors: 0.5, core: 0.3 },
    cue: 'Hips rotate, shoulders stay square. Start slow, then quicken the feet.' },
  { id: 'defslide', name: 'Defensive slides + closeouts', phase: 3, secs: 40, t: { adductors: 0.6, quads: 0.5, glutes: 0.4 },
    cue: 'Slide 3 steps, sprint 2 and chop your feet into a closeout. Both directions.' },

  { id: 'pogo', name: 'Pogo hops', phase: 4, secs: 30, reps: '2 × 10', covers: 'w7', power: true, t: { calves: 1 },
    cue: 'Stiff ankles, bounce off the floor as fast as you can. Tiny knee bend.' },
  { id: 'slhop', name: 'Low single-leg hops', phase: 4, sides: true, secs: 20, reps: '8 hops', power: true, t: { calves: 1, quads: 0.3 },
    cue: 'Small, quick and quiet. You’re waking up the tendon, not jumping high.' },
  { id: 'strides', name: 'Build-up strides', phase: 4, secs: 60, reps: '3 × 20 m, 60→80%', power: true, t: { hamstrings: 0.6, calves: 0.6, hips: 0.5 },
    cue: 'Start easy, build speed smoothly, never all-out. Walk back.' },
  { id: 'approach', name: 'Easy approach jumps', phase: 4, secs: 60, reps: '4 jumps at ~70%', power: true, t: { quads: 0.6, calves: 0.6, glutes: 0.6 },
    cue: 'Two- or three-step approach, off one foot and off two. Smooth, not max.' },
];

/* ---------- Extra stretches ----------
   Same shape as the nightly stretches (stretch.js). These only show up in picked routines and the
   adaptive builder, so the nightly picker doesn't change. `desk`: works sitting or standing in jeans. */
export const MORE_STRETCHES = [
  { id: 'quadstand', name: 'Standing quad stretch', pos: 0, sides: true, secs: 30, t: { quads: 1, hips: 0.4 },
    cue: 'Hold a wall, heel to glute, knees together. Tuck your pelvis under; don’t arch your low back.' },
  { id: 'hipstand', name: 'Split-stance hip flexor', pos: 0, sides: true, secs: 30, desk: true, t: { hips: 1, quads: 0.3 },
    cue: 'Long split stance, back heel up. Squeeze the back glute and tuck your hips under until the front of that hip opens.' },
  { id: 'calfstep', name: 'Step calf drop', pos: 0, sides: true, secs: 30, t: { calves: 1 },
    cue: 'Ball of the foot on a step, let the heel sink slowly. Hold the rail.' },
  { id: 'sidereach', name: 'Overhead side reach', pos: 0, sides: true, secs: 20, desk: true, t: { back: 0.8, core: 0.3 },
    cue: 'Feet together, reach one arm up and over. Long through the side, don’t lean forward.' },
  { id: 'neck', name: 'Upper-trap neck stretch', pos: 0, sides: true, secs: 20, desk: true, t: { shoulders: 0.6, back: 0.3 },
    cue: 'Sit on one hand, tip your ear toward the other shoulder. Gentle; let gravity do it.' },
  { id: 'seated4', name: 'Seated figure-4', pos: 0, sides: true, secs: 30, desk: true, t: { glutes: 1, hips: 0.3 },
    cue: 'Ankle on the opposite knee, sit tall and hinge forward a little from the hips.' },
  { id: 'chairtwist', name: 'Seated twist', pos: 0, sides: true, secs: 20, desk: true, t: { lowback: 0.6, back: 0.5 },
    cue: 'Sit tall, rotate from the middle of your back, hand on the chair back. Breathe and turn a little more.' },
  { id: 'threadst', name: 'Thread the needle hold', pos: 1, sides: true, secs: 30, t: { back: 0.7, shoulders: 0.6 },
    cue: 'Arm threaded under, shoulder and temple resting on the floor. Breathe into the back of your shoulder.' },
  { id: 'butterfly', name: 'Butterfly stretch', pos: 1, sides: false, secs: 40, t: { adductors: 1, hips: 0.3 },
    cue: 'Soles together, sit on a pillow if your back rounds. Let your knees drop; don’t push them.' },
  { id: 'sidequad', name: 'Side-lying quad stretch', pos: 2, sides: true, secs: 35, t: { quads: 1, hips: 0.5 },
    cue: 'On your side, pull the top heel to your glute, knee slightly behind you. Easier on the back than standing.' },
  { id: 'breathe', name: '90/90 breathing', pos: 2, sides: false, secs: 60, calm: true, t: { lowback: 0.6, core: 0.3 },
    cue: 'On your back, feet up on the couch, knees and hips at 90°. Breathe in through your nose, long exhale. Let your low back settle into the floor.' },
];

const ALL_STRETCHES = [...STRETCHES, ...MORE_STRETCHES];
const BY_ID = Object.fromEntries([...MOVES, ...ALL_STRETCHES].map((x) => [x.id, x]));

/* ---------- Presets ----------
   hue:   the routine's color (tile, player ring). icon: an Icon name.
   items: move or stretch ids, or [id, secs] to change the time. */
export const PRESETS = [
  // Warm-ups for an activity
  { id: 'w-lower', kind: 'warm', cat: 'activity', name: 'Lower lift day', icon: 'train', hue: '#ffcf5c',
    blurb: 'Your program warm-up, plus hips and ankles for squats and deadlifts.',
    items: ['bike', 'curlup', 'sideplank', 'birddog', 'bridge', 'ninety', 'adrock', 'ankle', 'squat', 'pogo'] },
  { id: 'w-upper', kind: 'warm', cat: 'activity', name: 'Upper lift day', icon: 'train', hue: '#7cc4ff',
    blurb: 'McGill big 3 for your back, then shoulders ready to press.',
    items: [['rope', 90], 'curlup', 'sideplank', 'birddog', 'thread', 'armc', 'wallslide', 'pullapart', 'pushup', 'pogo'] },
  { id: 'w-bball', kind: 'warm', cat: 'activity', name: 'Basketball', icon: 'ball', hue: '#ff9f4a',
    blurb: 'Hips, ankles and cuts, then a few easy jumps before you play.',
    items: [['bike', 120], 'bridge', 'legf', 'legs', 'ankle', 'wgs', 'askip', 'shuffle', 'defslide', 'pogo', 'approach'] },
  { id: 'w-jump', kind: 'warm', cat: 'activity', name: 'Jump day', icon: 'jump', hue: '#bba9ff',
    blurb: 'Wakes up the springs for box, broad and single-leg jumps.',
    items: [['bike', 120], 'bridge', 'ninety', 'ankle', 'legf', 'askip', 'pogo', 'slhop', 'approach'] },
  { id: 'w-run', kind: 'warm', cat: 'activity', name: 'Run or zone 2', icon: 'run', hue: '#7fdca0',
    blurb: 'Five quick minutes so the first mile doesn’t feel like concrete.',
    items: [['march', 60], 'legf', 'legs', 'ankle', 'bridge', 'scoop', 'kick', 'askip', 'strides'] },
  { id: 'w-quick', kind: 'warm', cat: 'activity', name: 'Home gym, 5 min', icon: 'clock', hue: '#d8d6cf',
    blurb: 'The minimum: heart rate up, big 3, hips, one set of pogos.',
    items: [['rope', 60], 'curlup', 'birddog', 'bridge', 'wgs', 'pogo'] },
  // Warm-ups for soreness / tightness
  { id: 'w-sorelegs', kind: 'warm', cat: 'sore', name: 'Sore legs', icon: 'heart', hue: '#ff8f7a',
    blurb: 'Longer, easier flush with no hard jumping. Blood in without beating them up.',
    items: [['bike', 240], 'bridge', 'clam', 'ninety', 'legf', 'legs', 'ankle', ['squat', 50]] },
  { id: 'w-back', kind: 'warm', cat: 'sore', name: 'Stiff low back', icon: 'heart', hue: '#ff8f7a',
    blurb: 'Gentle spine movement and the McGill big 3 before anything loads it.',
    items: [['march', 60], 'catcow', 'curlup', 'sideplank', 'birddog', 'deadbug', 'bridge', 'ninety'] },
  { id: 'w-hips', kind: 'warm', cat: 'sore', name: 'Tight hips', icon: 'heart', hue: '#ff8f7a',
    blurb: 'Every direction the hip moves, before you ask it to.',
    items: [['bike', 120], 'ninety', 'adrock', 'wgs', 'legf', 'legs', 'lunge', 'carioca'] },

  // Stretches for an activity
  { id: 's-bball', kind: 'stretch', cat: 'activity', name: 'After basketball', icon: 'ball', hue: '#ff9f4a',
    blurb: 'Calves, hips and inner thighs from cutting and jumping.',
    items: ['calf', 'couch', 'frog', 'hamstring', 'figure4', 'knees'] },
  { id: 's-lower', kind: 'stretch', cat: 'activity', name: 'After a lower day', icon: 'train', hue: '#ffcf5c',
    blurb: 'Quads, hamstrings and glutes, with your low back looked after.',
    items: ['hipflexor', 'child', 'sidequad', 'hamstring', 'figure4', 'knees'] },
  { id: 's-upper', kind: 'stretch', cat: 'activity', name: 'After an upper day', icon: 'train', hue: '#7cc4ff',
    blurb: 'Chest, lats and shoulders opened back up after pressing and pulling.',
    items: ['doorway', 'crossbody', 'triceps', 'lat', 'threadst', 'twist'] },
  { id: 's-run', kind: 'stretch', cat: 'activity', name: 'After a run', icon: 'run', hue: '#7fdca0',
    blurb: 'Calves, hip flexors and hamstrings.',
    items: ['calf', 'calfstep', 'hipflexor', 'hamstring', 'figure4'] },
  { id: 's-morning', kind: 'stretch', cat: 'activity', name: 'Morning wake-up', icon: 'today', hue: '#ffcf5c',
    blurb: 'Gentle, nothing forced. Your spine is stiffest right after bed.',
    items: [['knees', 30], 'twist', 'catcow', 'child', 'hipflexor', 'sidereach'] },
  { id: 's-desk', kind: 'stretch', cat: 'activity', name: 'Study break', icon: 'desk', hue: '#bba9ff',
    blurb: 'A few minutes at your desk in whatever you’re wearing.',
    items: ['hipstand', 'seated4', 'chairtwist', 'sidereach', 'neck', 'doorway'] },
  { id: 's-bed', kind: 'stretch', cat: 'activity', name: 'Before bed', icon: 'moon', hue: '#bba9ff',
    blurb: 'All on the floor, slow breathing, nothing intense.',
    items: ['child', 'figure4', 'hamstring', 'twist', 'breathe', 'wall'] },
  // Stretches for soreness / tightness
  { id: 's-back', kind: 'stretch', cat: 'sore', name: 'Tight low back', icon: 'heart', hue: '#ff8f7a',
    blurb: 'Hips and glutes first (they’re often behind it), then easy back relief.',
    items: ['catcow', 'hipflexor', 'child', 'figure4', 'knees', 'twist', 'breathe'] },
  { id: 's-quads', kind: 'stretch', cat: 'sore', name: 'Sore quads & hips', icon: 'heart', hue: '#ff8f7a',
    blurb: 'The front of your legs after squats, lunges and jumps.',
    items: ['quadstand', ['couch', 50], 'sidequad', 'ninety', 'figure4'] },
  { id: 's-hams', kind: 'stretch', cat: 'sore', name: 'Tight hamstrings', icon: 'heart', hue: '#ff8f7a',
    blurb: 'All lying down with a flat back, so your low back stays out of it.',
    items: [['hamstring', 50], 'figure4', 'frog', ['wall', 90]] },
  { id: 's-upper-sore', kind: 'stretch', cat: 'sore', name: 'Sore chest & shoulders', icon: 'heart', hue: '#ff8f7a',
    blurb: 'Easy holds for the day after bench and presses.',
    items: ['doorway', 'biceps', 'crossbody', 'threadst', 'lat'] },
  { id: 's-calves', kind: 'stretch', cat: 'sore', name: 'Calves & ankles', icon: 'heart', hue: '#ff8f7a',
    blurb: 'For the day after a lot of jumping.',
    items: [['calf', 40], 'calfstep', 'hamstring', 'wall'] },
];

export const ACTIVITIES = [
  { id: 'lift', name: 'Lift day' },
  { id: 'bball', name: 'Basketball' },
  { id: 'jumps', name: 'Jumps' },
  { id: 'run', name: 'Run / zone 2' },
  { id: 'general', name: 'General' },
];

/** A preset's moves, with any time changes applied. */
export function presetItems(p) {
  return p.items
    .map((x) => (Array.isArray(x) ? (BY_ID[x[0]] ? { ...BY_ID[x[0]], secs: x[1] } : null) : BY_ID[x]))
    .filter(Boolean);
}

export const routineSecs = (items) => items.reduce((a, s) => a + stretchSecs(s), 0);

/** "8 moves · 9 min" */
export function routineMeta(items, kind) {
  const n = items.length;
  const word = kind === 'warm' ? (n === 1 ? 'move' : 'moves') : n === 1 ? 'stretch' : 'stretches';
  return `${n} ${word} · ${Math.max(1, Math.round(routineSecs(items) / 60))} min`;
}

/* ---------- Adaptive ---------- */

const LEGS = ['quads', 'hamstrings', 'glutes', 'calves'];

// What each warm-up always includes (`must`), and what it leans toward (`like`).
const WARM_PLAN = {
  lift: { pulse: 'bike', must: ['curlup', 'sideplank', 'birddog', 'bridge', 'pogo'], like: ['ninety', 'ankle', 'wgs'], base: { hips: 0.4, glutes: 0.3, core: 0.3, calves: 0.2 } },
  bball: { pulse: 'bike', must: ['bridge', 'legf', 'legs', 'ankle', 'pogo'], like: ['askip', 'shuffle', 'defslide', 'approach', 'wgs'], base: { calves: 0.5, hips: 0.5, adductors: 0.4, quads: 0.3 } },
  jumps: { pulse: 'bike', must: ['bridge', 'ankle', 'pogo'], like: ['ninety', 'legf', 'askip', 'slhop', 'approach'], base: { calves: 0.6, hips: 0.4, glutes: 0.4, quads: 0.3 } },
  run: { pulse: 'march', must: ['legf', 'ankle', 'askip'], like: ['legs', 'bridge', 'scoop', 'kick', 'strides'], base: { calves: 0.5, hamstrings: 0.4, hips: 0.4 } },
  general: { pulse: 'march', must: ['catcow', 'bridge'], like: ['ninety', 'legf', 'armc', 'squat', 'birddog'], base: { hips: 0.4, lowback: 0.3, shoulders: 0.2 } },
};

// Stretches: these areas are covered every time (where you get tight), then your ratings.
const STRETCH_MUST = [['hamstring'], ['hipflexor', 'couch'], ['knees', 'child', 'catcow']];
const STRETCH_BASE = { hamstrings: 0.5, hips: 0.5, lowback: 0.5, glutes: 0.3, calves: 0.2 };

/**
 * Builds a routine from your ratings.
 *   kind:       'warm' | 'stretch'
 *   sore/tight: { muscle: 0-3 } (muscle ids from stretch.js MUSCLES)
 *   mins:       about how long
 *   activity:   what the warm-up is for (ACTIVITIES id)
 * Returns { items, secs, focus: [labels], notes: [strings] }.
 */
export function buildAdaptive({ kind, sore = {}, tight = {}, mins = 8, activity = 'lift' }) {
  const S = (m) => Number(sore[m]) || 0;
  const T = (m) => Number(tight[m]) || 0;
  const budget = mins * 60;
  const notes = [];
  const legSore = Math.max(...LEGS.map(S));
  const warm = kind === 'warm';
  const plan = warm ? WARM_PLAN[activity] || WARM_PLAN.lift : null;

  // How much each muscle wants attention.
  const need = { ...(warm ? plan.base : STRETCH_BASE) };
  for (const m of Object.keys(MUSCLES)) {
    const extra = S(m) * 1.0 + T(m) * 1.3;
    if (extra) need[m] = (need[m] || 0) + extra;
  }

  const pool = (warm ? MOVES : ALL_STRETCHES.filter((s) => !s.desk && !s.calm)).filter((x) => {
    if (warm && x.phase === 0) return false; // the pulse raiser is picked on its own
    if (warm && x.power && legSore >= 3) return false;
    if (warm && x.power && legSore >= 2 && x.id !== 'pogo' && !plan.must.includes(x.id)) return false;
    return true;
  });

  const topOf = (x) => Object.entries(x.t).sort((a, b) => b[1] - a[1])[0][0];
  // Holds: tightness gets longer, soreness gentler (a little shorter, never pushed).
  const fit = (x) => {
    const top = topOf(x);
    let secs = x.secs;
    if (!warm) {
      secs += T(top) * 10;
      if (S(top) >= 2 && !T(top)) secs = Math.max(secs - 5, 25);
    } else if (x.mob) secs += T(top) * 5;
    return secs === x.secs ? x : { ...x, secs };
  };

  const picked = [];
  const groups = new Set();
  const left = { ...need };
  let secs = 0;
  const has = (id) => picked.some((p) => p.id === id);
  const take = (x) => {
    const it = fit(x);
    picked.push(it);
    if (x.group) groups.add(x.group);
    secs += stretchSecs(it);
    for (const [m, w] of Object.entries(x.t)) left[m] = (left[m] || 0) * (1 - 0.65 * w);
  };
  const score = (x) => {
    const like = warm && plan.like.includes(x.id) ? 0.6 : 0;
    return (Object.entries(x.t).reduce((a, [m, w]) => a + w * (left[m] || 0), 0) + like) / Math.sqrt(stretchSecs(fit(x)) / 60);
  };

  if (warm) {
    // Raise the heart rate first: longer when legs are sore, shorter on a short warm-up.
    const pulse = BY_ID[plan.pulse];
    const pulseSecs = 15 * Math.round((Math.min(pulse.id === 'bike' ? 180 : 75, Math.max(60, budget * 0.2)) + (legSore >= 2 ? 45 : 0)) / 15);
    take({ ...pulse, secs: pulseSecs });
    for (const id of plan.must) {
      const x = BY_ID[id];
      if (x.power && legSore >= 3) {
        if (id === 'pogo') take({ ...x, secs: 20, reps: '1 × 10, low and easy' });
        continue;
      }
      take(x);
    }
    if (legSore >= 3) notes.push('Legs very sore: hard jumps are out and pogos are one easy set.');
    else if (legSore === 2) notes.push('Legs sore: a longer easy start so they loosen up before anything fast.');
  } else {
    for (const ids of STRETCH_MUST) {
      const opts = ids.map((id) => BY_ID[id]).filter((x) => !(x.group && groups.has(x.group)));
      if (!opts.length) continue;
      const best = opts.reduce((a, b) => (score(b) > score(a) ? b : a));
      if (!has(best.id)) take(best);
    }
    if (Object.keys(MUSCLES).some((m) => S(m) >= 2)) notes.push('For sore spots, stop at mild tension. Stretching harder won’t speed up recovery.');
  }

  // Every rated area gets at least one move aimed at it, worst first, while there's room.
  const rated = Object.keys(MUSCLES).filter((m) => S(m) + T(m) > 0).sort((a, b) => S(b) + T(b) - (S(a) + T(a)));
  // Before a workout, a sore muscle gets an easy move (blood flow), not a loaded one.
  const okFor = (x) => !warm || x.gentle || Object.entries(x.t).every(([m, w]) => w < 0.5 || S(m) < 2);
  for (const m of rated) {
    if (picked.some((p) => (p.t[m] || 0) >= 0.7)) continue;
    const opts = pool.filter((x) => !has(x.id) && (x.t[m] || 0) >= 0.7 && !(x.group && groups.has(x.group)) && okFor(x));
    if (!opts.length) continue;
    const best = opts.reduce((a, b) => ((b.t[m] || 0) + score(b) * 0.2 > (a.t[m] || 0) + score(a) * 0.2 ? b : a));
    if (secs + stretchSecs(fit(best)) > budget + 90) continue; // rated areas may run a minute or so over
    take(best);
  }

  // Then fill the time with whatever covers the most.
  for (;;) {
    if (secs >= budget - 20) break;
    // An area you didn't rate gets one move of its own, not two that do the same thing.
    const twin = (x) => { const m = topOf(x); return !(S(m) + T(m)) && picked.some((p) => topOf(p) === m); };
    const opts = pool.filter((x) => !has(x.id) && !(x.group && groups.has(x.group)) && okFor(x) && !twin(x) && secs + stretchSecs(fit(x)) <= budget + 30);
    if (!opts.length) break;
    const best = opts.reduce((a, b) => (score(b) > score(a) ? b : a));
    if (score(best) <= 0.05) break;
    take(best);
  }

  // A stretch with room left ends on a calm one.
  if (!warm) {
    const calm = T('lowback') + S('lowback') > 0 ? BY_ID.breathe : BY_ID.wall;
    if (secs + stretchSecs(calm) <= budget + 45) take(calm);
  }

  const order = warm
    ? (a, b) => a.phase - b.phase || MOVES.findIndex((x) => x.id === a.id) - MOVES.findIndex((x) => x.id === b.id)
    : (a, b) => a.pos - b.pos || (a.calm ? 1 : 0) - (b.calm ? 1 : 0) || ALL_STRETCHES.findIndex((x) => x.id === a.id) - ALL_STRETCHES.findIndex((x) => x.id === b.id);
  const items = picked.sort(order);
  const focus = rated.slice(0, 4).map((m) => MUSCLES[m]);
  return { items, secs: routineSecs(items), focus, notes };
}

/* ---------- Finishing ---------- */

/**
 * Saves a `routine` record. A stretch finished after 5 pm counts as tonight's stretch. A warm-up
 * finished inside a lift day returns the checklist lines it covered.
 */
export function logRoutine({ kind, name, items }) {
  const date = todayISO();
  put('routine', { id: newId(), date, kind, name, secs: routineSecs(items), moves: items.map((x) => x.id), at: new Date().toISOString() });
  if (kind === 'stretch' && new Date().getHours() >= 17) markStretched(date);
  return [...new Set(items.map((x) => x.covers).filter(Boolean))];
}
