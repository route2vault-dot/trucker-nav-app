# Supreme Trucking Navigation (STN)

A navigation and road-awareness app built for truck drivers running the **South-Central Freight Corridor** — Texas, Oklahoma, Louisiana, Arkansas, and New Mexico. The goal: beat Trucker Path at the things drivers actually need, starting simple and free.

## Who this is for

Real working truck drivers. The first user is the project owner's dad, who needs something usable **this week** — not a perfect app someday.

## What it will do

| Feature | Why it matters to a driver |
|---|---|
| Truck-safe routing | Avoid low bridges and weight-restricted roads (car GPS will kill you) |
| Live road closures & incidents | State 511 feeds for TX, OK, LA, AR, NM |
| Low-clearance / restriction map | Bridge heights from OpenStreetMap, visible before you're under them |
| Driver-reported hazards | Crowd-sourced reports (the thing Waze/Google won't give away) |
| Truck parking & stops | Where can I actually park this thing tonight? |
| Weather alerts | National Weather Service warnings along the route |
| Fuel price awareness | Regional diesel averages + driver-reported prices |

## Project status

**Planning phase.** No app code exists yet. Read the docs in this order:

1. [docs/MVP-PLAN.md](docs/MVP-PLAN.md) — the phased build plan (start here)
2. [docs/API-OPTIONS.md](docs/API-OPTIONS.md) — which free services we'll use and why
3. [docs/SOURCE-MAP.md](docs/SOURCE-MAP.md) — state DOT 511 data sources
4. [docs/APP-MAP.md](docs/APP-MAP.md) — planned folder structure and app layers
5. [CLAUDE.md](CLAUDE.md) — working instructions for Claude (the AI assistant building this)

## Guiding principles

1. **Ship the simplest usable thing first.** A driver using version 0.1 this week beats a perfect app in six months.
2. **Free tier everything.** No paid services until the app proves itself.
3. **Beginner-friendly.** The project owner is learning as we go — plain language, simple stack, no clever tricks.
4. **Safety-honest.** Never pretend data is more reliable than it is. A missing bridge height is a warning, not a green light.
