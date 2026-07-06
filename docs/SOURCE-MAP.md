# SOURCE-MAP.md — State DOT 511 / Traveler-Info Systems

The five corridor states each run an official traveler-information system with closures, construction, and incidents. This file maps what each state offers and where the data likely lives.

> ✅ **Liveness check 2026-07-06:** all five public map URLs below returned HTTP 200 — sites are live and correctly named. The *data endpoints* (API/feed URLs) are still unverified leads; confirming those is the first task of Phase 1. Anything marked *(verify)* is a lead, not a fact.

---

## Texas — DriveTexas (TxDOT)

- **Public map:** https://drivetexas.org
- **Phone:** 1-800-452-9292
- **Data access:**
  - DriveTexas publishes highway conditions data; API access historically requires a **free access request to TxDOT** *(verify — look for an "API" or "Developers" link on drivetexas.org)*
  - **TxDOT Open Data Portal (ArcGIS):** https://gis-txdot.opendata.arcgis.com — roadway, bridge, and restriction datasets as downloadable GeoJSON/REST services *(verify which layers include live conditions vs static inventory)*
- **Notes:** Biggest state, most data. Also check TxDOT's bridge clearance datasets here as a cross-check for OSM gaps.

## Oklahoma — ODOT Traveler Information

- **Public map:** https://oktraffic.org *(verify — ODOT's traveler info system; branding has changed over the years)*
- **Data access:**
  - ODOT ArcGIS REST services for road conditions/incidents *(verify — inspect the network requests the public map makes; these systems are usually backed by a public JSON/REST feed)*
- **Notes:** Oklahoma's system is less publicized than the others; expect some detective work. The public map's own data feed is the fallback.

## Louisiana — 511 Louisiana (DOTD)

- **Public map:** https://www.511la.org
- **Phone:** dial 511 in-state
- **Data access:**
  - 511la.org has historically offered a **developer/data-feed program with free registration** (XML/JSON feeds for events, closures, cameras) *(verify — look for "Developer" or "Data Feeds" in the site footer)*
- **Notes:** Louisiana matters for hurricane-season closures and bridge/ferry status — the alerts feed is high-value here.

## Arkansas — IDriveArkansas (ArDOT)

- **Public map:** https://www.idrivearkansas.com
- **Data access:**
  - The IDriveArkansas map is backed by public **GeoJSON/ArcGIS feeds** for incidents, construction, and weather-related closures *(verify by inspecting the map's network requests; ArDOT has been developer-friendlier than most)*
- **Notes:** Arkansas also publishes winter road-condition layers seasonally.

## New Mexico — NMRoads (NMDOT)

- **Public map:** https://www.nmroads.com
- **Phone:** dial 511 in-state
- **Data access:**
  - NMRoads is backed by REST/JSON endpoints that the public map itself consumes *(verify by inspecting network requests; historically included alerts, incidents, and district conditions)*
- **Notes:** Critical for I-40/I-10 wind and dust-storm closures, which shut down truck traffic several times a year.

---

## How we'll actually verify (Phase 1, step 1)

For each state, in order:

1. Open the public map site and look for an official **"Developers" / "Data" / "API"** link — always prefer the documented route.
2. If none exists, open the browser's developer tools (Network tab) on the public map and note the JSON/GeoJSON URLs the map itself loads. These are usually public, but check the site's terms of use.
3. Record in this file: the working URL, the data format, whether a key/registration is needed, how often it updates, and any usage terms.
4. If a state offers **email/registration-based access** (like Texas), submit the request early — approval can take days.

## Fallbacks if a state's feed is unusable

- **NWS alerts** (api.weather.gov) cover weather-driven closures in all states.
- **Our own driver reports** (Phase 2) cover what official feeds miss.
- Worst case, a state's incidents ship in a later phase — the app degrades gracefully by state, it doesn't block the MVP.

## One format to rule them all

Each state's feed will look different (different vendors build these systems). Plan: one small "translator" per state that converts whatever the state provides into a single common incident format (location, type, description, severity, updated-time) so the map code only ever deals with one shape.
