# MVP-PLAN.md — Phased Build Plan

**North star:** Dad can use something helpful in his truck THIS WEEK. Every phase ships a working thing; nothing waits on a later phase.

**An honest note before Phase 0:** a full voice turn-by-turn navigator (like Google Maps talks to you) is the *hardest* feature, not the easiest. Phase 0 therefore focuses on what car GPS apps *can't* do — plan a truck-safe route and show hazards — and Dad can still let his current GPS talk while STN rides shotgun for truck-specific warnings. Voice guidance comes later (Phase 4).

---

## Phase 0 — "This Week" (target: 2–3 days of build time)

**Goal:** a link Dad opens on his phone that shows a map, plans a truck-safe route, and warns about low bridges.

What it does:
- [x] Full-screen map of the corridor (Leaflet + OpenStreetMap tiles) *(built 2026-07-06)*
- [x] "Where to?" search box → address lookup (Nominatim, free, no key)
- [x] Truck-safe route via OpenRouteService truck profile with rig dimensions in settings *(code done — awaiting user's free ORS key for a live test)*
- [x] Low-clearance bridges as warning pins — 5,334 points downloaded from OSM for all 5 states (1,142 under 13'6"); red = won't fit, orange = tight
- [x] **Active low-bridge avoidance** *(added 2026-07-06)*: every route is checked against our bridge database; too-low bridges ON the route get wrapped in ORS `avoid_polygons` boxes and the route is re-requested (up to 4 rounds). Red banner only if no way around exists; amber caution if low bridges are merely nearby. Live-verified: baseline ORS route passed 11 m from a 6'8" Dallas underpass ORS's own data missed; the loop rerouted clean in 2 iterations.
- [x] Blue dot: driver's live GPS position
- [x] Big-button, high-contrast UI with day/night toggle
- [x] "Add to Home Screen" instructions *(standard browser feature — see README)*
- [x] Hosted free on GitHub Pages: **https://route2vault-dot.github.io/trucker-nav-app/** *(live 2026-07-06, auto-deploys on every push to `main` via `.github/workflows/deploy.yml`)*

Verified 2026-07-06: OSM tiles ✓, Nominatim ✓, Overpass ✓, ORS truck routing ✓ (live test: 1,098 mi route, 13 low bridges flagged, lowest 12'10"), all five 511 sites live ✓. Local test server: `powershell -File scripts\serve.ps1` → http://localhost:8080

**Phase 0 is DONE.** Repo: https://github.com/route2vault-dot/trucker-nav-app — next real-world step is Dad using it and reporting back before starting Phase 1.

What it deliberately does NOT do yet: voice directions, live traffic, driver reports, parking, fuel, weather. Resist the urge.

**Definition of done:** Dad plans a real route he actually drives, and the route avoids a restriction his car GPS wouldn't know about.

---

## Phase 1 — Live Road Intelligence (week 2)

**Goal:** the map knows what's happening on the road *right now*.

- [ ] Verify each state's 511 data endpoint actually works (see SOURCE-MAP.md — this is step one, before any code)
- [ ] Road closures & incidents from TX, OK, LA, AR, NM 511 feeds as map icons, refreshed every few minutes
- [ ] National Weather Service alerts (api.weather.gov — totally free, no key) shown as shaded warning areas
- [ ] "On my route" filter: only show incidents/alerts near the planned route
- [ ] Simple legend so icons are self-explanatory

**Definition of done:** a real closure that's on DriveTexas.org also shows up in STN within minutes.

---

## Phase 2 — Driver Reports (weeks 3–4) — *the Trucker Path killer feature*

**Goal:** drivers can report and see hazards — the crowd-sourced data Waze/Google won't share.

- [ ] Supabase project (free tier) with a `reports` table: type, location, note, timestamp
- [ ] One-tap report buttons: **Police / Scale open / Crash / Debris / Low bridge! / Tight turn / Closed road**
- [ ] Reports appear on everyone's map immediately
- [ ] Confirm 👍 / Gone 👎 voting; reports fade out after a few hours unless confirmed
- [ ] Basic abuse protection: rate limiting, no login required at first (friction kills reporting)

**Definition of done:** Dad reports something from the cab in under 5 seconds (two taps), and it shows on a second phone.

---

## Phase 3 — Parking, Fuel & Stops (weeks 5–6)

**Goal:** answer "where do I stop tonight and where's cheap diesel?"

- [ ] Truck stops & rest areas layer from OpenStreetMap (pre-downloaded for the corridor); flag which allow overnight parking where known
- [ ] Driver-reported parking status ("lot full" / "spaces open") using the Phase 2 reports system
- [ ] Regional diesel price averages from the EIA API (free), plus driver-reported prices at specific stops
- [ ] "Along my route" search: stops within X miles of the route, sorted by distance ahead

**Definition of done:** Dad picks tonight's stop using the app instead of guessing.

---

## Phase 4 — Polish & Power Features (ongoing, prioritized by Dad's feedback)

Ideas, in rough priority order — re-rank after real use:

- [ ] Voice alerts ("Low bridge in 2 miles") using the browser's built-in speech, even without full turn-by-turn
- [ ] Turn-by-turn guidance view with spoken directions
- [ ] Offline map caching for dead zones (west Texas, we're looking at you)
- [ ] Weigh station locations & driver-reported open/closed status
- [ ] Route sharing (send tonight's plan to dispatch/family)
- [ ] Wrap as a real Android app with Capacitor if the web version hits limits
- [ ] Expand beyond the 5-state corridor

---

## How we work each phase

1. Verify external data sources first (nothing worse than building UI for a dead API).
2. Build the smallest working version, test it on a phone screen.
3. Dad tries it on a real drive. His complaints become the next to-do list.
4. Check off boxes above so any future session knows where we are.
