# APP-MAP.md — Folder Structure & App Layers

This is the **planned** structure. Nothing in `app/`, `server/`, or `scripts/` exists yet — folders get created only when the phase that needs them starts.

## Folder structure

```
trucker-nav-app/
├── README.md              Project overview
├── CLAUDE.md              Instructions for Claude between sessions
├── docs/
│   ├── APP-MAP.md         This file
│   ├── MVP-PLAN.md        Phased build plan (source of truth for "what's next")
│   ├── API-OPTIONS.md     Free-tier service comparison & choices
│   └── SOURCE-MAP.md      State 511 data sources
│
├── app/                   ── Phase 0 ── the actual app (a static website)
│   ├── index.html         The single page the driver opens
│   ├── css/
│   │   └── style.css      Big-button, high-contrast, driver-friendly styling
│   ├── js/
│   │   ├── config.js      API keys & settings (git-ignored; config.example.js is committed)
│   │   ├── map.js         Leaflet map setup
│   │   ├── routing.js     Truck routing (OpenRouteService calls)
│   │   ├── hazards.js     Low-bridge / restriction overlays (Overpass data)
│   │   ├── traffic.js     ── Phase 1 ── 511 closures & incidents
│   │   ├── weather.js     ── Phase 1 ── NWS alerts
│   │   ├── reports.js     ── Phase 2 ── driver-submitted hazards (Supabase)
│   │   └── stops.js       ── Phase 3 ── parking, truck stops, fuel
│   └── data/
│       └── *.geojson      Pre-downloaded static data (bridge heights, seed truck stops)
│
├── scripts/               ── Phase 1+ ── helper scripts run occasionally on the PC
│   └── fetch-*.js         e.g. refresh bridge-height data from Overpass
│
└── server/                ── only if ever needed ── most "backend" needs are
                              covered by Supabase, so this may never exist
```

## App layers (how the pieces talk to each other)

```
┌─────────────────────────────────────────────────────┐
│ 1. DRIVER'S PHONE — mobile web app (PWA)            │
│    Big map, search box, route display, hazard pins   │
│    Plain HTML/CSS/JS + Leaflet. Installable to the   │
│    home screen like a normal app.                    │
└───────────────┬─────────────────────────────────────┘
                │ calls out to…
┌───────────────┴─────────────────────────────────────┐
│ 2. FREE EXTERNAL SERVICES (no server of our own)    │
│    • OpenStreetMap tiles ……… draws the map           │
│    • OpenRouteService ……… truck-safe routing         │
│    • Overpass API ……… bridge heights & restrictions  │
│    • State 511 feeds ……… closures & incidents        │
│    • api.weather.gov ……… weather alerts (no key!)    │
│    • EIA API ……… regional diesel prices              │
└───────────────┬─────────────────────────────────────┘
                │ driver reports stored in…
┌───────────────┴─────────────────────────────────────┐
│ 3. DATABASE — Supabase free tier (Phase 2)          │
│    Crowd-sourced hazard reports, fuel-price reports, │
│    confirm/deny votes. Supabase gives us a database  │
│    + a ready-made web API, so we skip writing a      │
│    backend entirely.                                 │
└─────────────────────────────────────────────────────┘

HOSTING: GitHub Pages or Netlify (free). The app is just
files, so hosting is free and there's no server to maintain.
```

## Key design decisions (and the plain-English why)

| Decision | Why |
|---|---|
| **Web app, not native app** | No app store, no Mac needed, no approval wait. Dad opens a link, taps "Add to Home Screen," done. Can be wrapped into a native app later (Capacitor) if we ever want it. |
| **No custom backend** | A backend is a server we'd have to write, secure, and pay for. Supabase gives us the database part for free; everything else is direct calls to public APIs. |
| **Static data files for bridge heights** | Bridge locations rarely change. Downloading them once into `app/data/` is faster and more reliable than live-querying Overpass while driving. |
| **`config.js` git-ignored** | API keys must never be committed publicly. A `config.example.js` template shows what keys are needed. |
