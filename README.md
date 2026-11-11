# fit+

Workouts and health, in the same style as lifestyle+ and shoot+ (dark grainy look, springy motion,
haptics, accent color, logo color and heading font choices). Installed from Safari to the Home Screen.

It runs Ethan's 8-Week Galpin Program for you: every lift day it works out the exercises, sets, weight,
reps and rest from what you logged last time, then adjusts for how you feel today.

- **Today** — which week of the 8 you're in, the next workout with its main lift's weight, this week's
  lifts / zone 2 minutes / hard session, protein so far, your weight trend and your vertical.
- **Train** — pick a day (it suggests the next one), rate soreness per muscle, sleep and basketball, see
  exactly what changed and why, then lift: target weight on each exercise, tap reps-left-in-the-tank to
  log a set, the rest timer starts on its own. Warm-up checklist, supersets, finish with a back rating.
- **Fuel** — protein against 0.8 g per pound (from your latest weigh-in), one-tap saved meals, the last
  7 days, weight with a 7-day average and whether you're gaining at the right pace.
- **Progress** — estimated max on each main lift, weekly sets per muscle against Galpin's 10–20, zone 2
  per week, vertical jump tests, back ratings and what came before flare-ups, records, history.
- **Plan** — the 8 weeks, each day's exercises with next time's weights, swaps (lat pulldown for pull-ups,
  safety bar for front squat…), setting a weight by hand, the warm-up and the rules.
- **+ button** — log protein, a weigh-in or cardio.

## How the workouts are written

All in `src/lib/engine.js`, from the program in `src/lib/program.js`:

- **Weeks** from the Monday you pick: 1–3 build (main lifts 4 × 5), 4 deload, 5–7 strength (5 × 3),
  8 deload + vertical retest. Then it starts again with your new numbers.
- **Main lifts**: every rep with 2+ in the tank → +5 lb next week. Missed reps or failure → same weight.
  Missed reps on 2+ sets → 5% lighter. Moving to 5 × 3 → worked out from your estimated max
  (weight × (1 + (reps + reps in reserve) / 30)).
- **Hypertrophy**: top of the rep range on every set → +5 lb (dumbbells) or +10 lb (machines) and back to
  the bottom of the range; otherwise same weight, aim for one more rep.
- **Deloads**: half the sets, same weights, jumps 2 × 3.
- **Soreness** (0–3 per muscle): 2 → one set fewer, main lifts aim for 3 in the tank; 3 → hypertrophy for
  that muscle skipped, main lift 10% lighter. Legs 2+ or basketball yesterday → half the jumps. Low back
  2+ → front squat becomes split squats, trap bar 15% lighter. Soreness only changes that day; next
  week's weights come from what you actually lifted.
- **Back over 3/10** last session → lower-body main lift 10% lighter next time.
- **Under 6 hours of sleep** → it offers the minimum session (jumps + main lift).

## Run it on your computer

```bash
npm install
npm run dev
```

It starts with sample data (you're in week 3 of a made-up block). Tap **Clear it** at the top to start
fresh, then pick the Monday your week 1 starts.

## Set up the database (Supabase)

fit+ lives in the **same Supabase project as lifestyle+ and shoot+**, in its own tables (`fit_records`
and `fit_record_history`), so the apps never see or change each other's data. Your sign-in is shared:
the same email and password work in all three.

1. In that Supabase project, open **SQL Editor → New query**, paste `supabase/fit-plus.sql`, press **Run**.
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key (the same ones lifestyle+ uses).
3. Copy `.env.example` to `.env` and paste the two values in. Restart `npm run dev`.
4. Open **Settings** (top right) and sign in with your lifestyle+ account.

## Put it on your iPhone

1. Make a new GitHub repo (for example `fit-plus`) and push this folder to it.
2. At [vercel.com](https://vercel.com), import the repo. It detects Vite.
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy.
4. Open the site in **Safari** → **Share → Add to Home Screen**.

Long-press the Home Screen icon for **Start workout** and **Log protein** shortcuts. Sign in again inside
the installed app.

## How the data works

Same as lifestyle+: every workout, weigh-in, protein entry, cardio session and vertical test is one row in
a records table. Changes save on the phone first (works offline, including mid-workout in a gym with no
signal), then sync. Newer edits win. Row Level Security means only your account can read your rows.

## Project map

```
src/
  App.jsx                    tabs, header, + button, rest timer bar, which sheet is open
  store.js                   local storage + Supabase sync + sign in (from lifestyle+)
  seed.js                    sample data
  lib/program.js             the 8-week program: exercises, days, weeks, warm-up, back rules
  lib/engine.js              weeks, progression, today's adjustments, weekly sets, records
  lib/data.js                reading and writing workouts, weigh-ins, protein, cardio
  lib/rest.js                the rest timer
  lib/logo.js                the glass dumbbell + plus mark (header, loading screen, icons)
  views/                     Today, Train, Fuel, Progress, Plan
  components/QuickLog.jsx    the + sheet and the vertical test
  components/Charts.jsx      line, band bars, column bars
  styles.css                 lifestyle+ styles plus fit+ pieces at the end
supabase/fit-plus.sql        the tables (run once)
```

Not medical advice. Pain that's sharp, lingers, or runs down a leg means stop and see a physical therapist.
