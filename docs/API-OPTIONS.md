# API-OPTIONS.md — Free-Tier Service Comparison

Legend: 🟢 **100% free** · 🟡 **free tier with limits** · 🔴 **paid / not realistically free**

Limits below are from general knowledge as of mid-2026 planning — **re-check each provider's pricing page before signing up**, since free tiers change.

---

## 1. Map rendering (drawing the map on screen)

| Option | Cost | Notes |
|---|---|---|
| **Leaflet + OpenStreetMap tiles** ✅ CHOSEN | 🟢 | Leaflet is a free open-source map library; OSM's public tile server is free for light use (fine for a handful of drivers). If usage grows, swap in a free-tier tile host — one line of code. Simplest possible start. |
| MapLibre GL + OpenFreeMap tiles | 🟢 | Prettier vector maps, smoother zoom. Slightly harder to learn than Leaflet. Good future upgrade; not needed for MVP. |
| Mapbox GL JS | 🟡 ~50k map loads/month free | Beautiful, but requires an account tied to billing, and costs kick in if the app grows. Vendor lock-in. |

**Choice: Leaflet + OSM.** Zero cost, zero signup, huge community, and every tutorial on the internet covers it. Upgrade path exists if we ever want prettier maps.

## 2. Truck routing (routes that respect height/weight limits)

| Option | Cost | Notes |
|---|---|---|
| **OpenRouteService (ORS)** ✅ CHOSEN | 🟡 free key, ~2,000 routes/day | Has a dedicated **heavy-goods-vehicle profile** that accepts height, weight, width, length, and hazmat parameters. 2,000/day is far more than a few drivers need. Also provides free geocoding (address search). |
| Self-hosted OSRM or Valhalla | 🟢 (but needs a server) | Total control, no limits — but we'd have to run a server and process map data ourselves. Too much for a beginner project now; the "graduation" option if STN takes off. |
| HERE Routing API | 🟡 ~250k transactions/month free | Excellent commercial truck routing, but requires a credit card on file. Backup option. |
| GraphHopper (hosted) | 🟡 / 🔴 | Free tier exists but truck-specific routing is on paid plans. Skip. |
| TomTom Routing | 🟡 ~2,500 requests/day free | Truck parameters supported; decent backup. Requires account. |
| Google Maps Directions | 🔴 for our purpose | **No truck routing at all** — this is exactly why car GPS gets trucks stuck under bridges. |

**Choice: OpenRouteService.** Free key, real truck profile, generous limits, plus free address search from the same account. Important caveat: ORS relies on OpenStreetMap restriction data, which is incomplete — that's why we ALSO overlay bridge-height warnings (lane 6) instead of blindly trusting the route.

## 3. Live traffic, incidents & closures

| Option | Cost | Notes |
|---|---|---|
| **State 511 feeds (TX, OK, LA, AR, NM)** ✅ CHOSEN | 🟢 (some need free registration) | Official DOT data: closures, construction, crashes. Details per state in SOURCE-MAP.md. Must be verified live before Phase 1. |
| National Weather Service alerts | 🟢 | Road-relevant warnings (ice, flood, dust, high wind) — see Weather below. |
| Waze data | 🔴 | Only shared with government partners ("Waze for Cities"). Not available to us — which is exactly the gap our driver reports (lane 4) fill. |
| Google / HERE / TomTom traffic flow | 🟡–🔴 | Congestion coloring is nice-to-have, not need-to-have. Revisit in Phase 4. |

**Choice: state 511 feeds + our own driver reports.** Free, official, and covers exactly our 5 states.

## 4. Weather

| Option | Cost | Notes |
|---|---|---|
| **National Weather Service (api.weather.gov)** ✅ CHOSEN | 🟢 no key, no signup, no limits (be polite) | US government API: active alerts by area, forecasts by point. Perfect for a US-only corridor. This one's a gift — use it. |
| OpenWeatherMap | 🟡 ~1,000 calls/day free | Global and easy, but NWS is free-er and official. Backup only. |
| Radar tiles (RainViewer) | 🟢 free tier | Animated radar overlay for the map — nice Phase 4 addition. |

**Choice: NWS.** 100% free with no key. Rare and wonderful.

## 5. Fuel prices — ⚠️ the honest bad news

| Option | Cost | Notes |
|---|---|---|
| **EIA API (US Energy Information Admin)** ✅ CHOSEN (partial) | 🟢 free key | Official diesel price **averages by region/state, updated weekly**. Great for "is fuel cheaper in OK or TX this week?" — useless for "what does this exact Pilot charge today." |
| **Our own driver reports** ✅ CHOSEN (partial) | 🟢 | Drivers report prices at stops (Phase 3). This is literally how GasBuddy started. |
| GasBuddy / OPIS / fuel-card APIs | 🔴 | Station-level price data is a paid, licensed product everywhere. No free API exists. |

**Choice: EIA regional averages + crowd-sourced station prices.** There is no free station-level diesel API — anyone who claims otherwise is scraping and will break. We say so in the UI.

## 6. Bridge heights & truck restrictions (map overlay data)

| Option | Cost | Notes |
|---|---|---|
| **OpenStreetMap via Overpass API** ✅ CHOSEN | 🟢 (shared servers, rate-limited) | Query all bridges with `maxheight`, roads with `maxweight`/`hgv=no` in our 5 states. We download this **once into static files** rather than querying live — kinder to the free servers and works in dead zones. Refresh monthly with a script. |
| FHWA / state DOT bridge inventories | 🟢 | Official National Bridge Inventory data — good for cross-checking OSM gaps later. |

## 7. Truck parking data

| Option | Cost | Notes |
|---|---|---|
| **OpenStreetMap truck stops & rest areas** ✅ CHOSEN | 🟢 | Locations of truck stops, rest areas, and parking. Coverage is decent on interstates, spotty off them. |
| Driver reports ("lot full") | 🟢 | Phase 2 reports system reused — real-time status no static database can give. |
| TPIMS real-time parking feeds | 🟢 where available | Some states publish live truck-parking counts, but coverage is mostly Midwest corridors; check TX I-10 pilot projects during Phase 3. |
| Jason's Law / FHWA survey data | 🟢 | Static federal dataset of truck parking facilities — good seed data. |

## 8. Database & backend (for driver reports)

| Option | Cost | Notes |
|---|---|---|
| **Supabase** ✅ CHOSEN | 🟡 free: ~500MB database, 50k monthly active users | A hosted database with a ready-made API — we write zero server code. Free tier is enormous relative to our needs. Pauses after a week of no traffic (a visit wakes it). |
| Firebase (Google) | 🟡 | Similar idea; fine, but Supabase's plain-SQL model is easier to reason about and export. |
| No backend at all | 🟢 | Correct answer for Phase 0/1 — those phases need no database whatsoever. |

## 9. Hosting

| Option | Cost | Notes |
|---|---|---|
| **GitHub Pages** ✅ CHOSEN | 🟢 | Free static hosting straight from the code repository. |
| Netlify / Cloudflare Pages | 🟢 free tiers | Equally good; either is a fine substitute. |

---

## The chosen stack, on one line each

- **Map:** Leaflet + OpenStreetMap — 🟢 free
- **Routing:** OpenRouteService truck profile — 🟡 free key, ~2,000/day
- **Incidents:** State 511 feeds — 🟢 free (verify endpoints first)
- **Weather:** api.weather.gov — 🟢 free, no key
- **Fuel:** EIA averages 🟢 + crowd-sourced prices 🟢
- **Restrictions:** OpenStreetMap/Overpass, downloaded to static files — 🟢
- **Parking:** OSM + driver reports — 🟢
- **Database:** Supabase — 🟡 free tier (Phase 2+ only)
- **Hosting:** GitHub Pages — 🟢

**Total monthly cost of the MVP: $0.** The only signups needed are OpenRouteService (Phase 0), EIA (Phase 3), and Supabase (Phase 2).
