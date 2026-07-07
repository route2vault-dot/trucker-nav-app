/* STN routing: address search (Nominatim, free) + truck-safe route (OpenRouteService)

   IMPORTANT ORS limits (confirmed by live testing, not documented clearly):
     - avoid_polygons requests are capped at ~150,000 m of route length.
     - alternative_routes requests are capped at ~100,000 m of route length.
   Neither limit applies to plain weighting params (preference, avoid_features),
   so route VARIETY comes from requesting several genuinely different weightings
   rather than ORS's native alternative_routes:

     Recommended — ORS's balanced default
     Fastest     — preference: fastest
     Shortest    — preference: shortest (fewer miles, often slower)
     Avoid Tolls — avoid_features: tollways

   ("Avoid Highways" was deliberately left out: ORS only avoids roads that are
   explicitly tagged with truck restrictions, and most minor/residential roads
   aren't tagged at all — forcing a truck off the highway network risks a route
   ORS has no real basis for calling truck-appropriate.)

   Every weighting above gets put through the EXACT SAME low-bridge check
   before it's shown to the driver:

     SHORT routes (<= SHORT_MAX_M): a normal avoid_polygons reroute loop
     (comfortably under both ORS length caps).

     LONG routes: neither special feature can span the whole trip, so each
     low bridge actually on the route gets a LOCAL detour — a small window
     (a few miles) around it is re-requested with avoid_polygons (well under
     the 150 km cap) and spliced into the original route. */

STN.routing = {
  routeLayer: null,
  destMarker: null,

  WEIGHTINGS: [
    { key: "recommended", label: "Recommended", extra: { preference: "recommended" } },
    { key: "fastest",     label: "Fastest",     extra: { preference: "fastest" } },
    { key: "shortest",    label: "Shortest",    extra: { preference: "shortest" } },
    { key: "avoidTolls",  label: "Avoid Tolls", extra: { preference: "fastest", avoidFeatures: ["tollways"] } }
  ],
  DEDUPE_M: 50,          // options within this distance of each other = same route

  ON_ROUTE_M: 30,        // bridge within this = truck would drive under it
  NEARBY_M: 100,         // bridge within this = worth a caution note
  SHORT_MAX_M: 90000,    // ~56 mi — safely under both ORS length caps
  SHORT_MAX_REROUTES: 6, // short trips rarely need many rounds
  WINDOW_M: 6437,        // ~4 mi local detour window
  WINDOW_BIG_M: 16093,   // ~10 mi fallback window if the small one fails
  CLUSTER_GAP_M: 8000,   // bridges closer than this share one detour window

  /* ---------- 1. search the destination ---------- */
  search: function () {
    var q = STN.el("dest").value.trim();
    if (!q) { STN.status("Type a destination first."); return; }
    STN.status("Searching…", 15000);

    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us" +
      "&viewbox=-109.1,37.1,-88.8,25.6&q=" + encodeURIComponent(q);

    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (results) {
        STN.hide("statusMsg");
        if (!results.length) { STN.status("No match found. Try adding the city or state."); return; }
        if (results.length === 1) { STN.routing.pick(results[0]); return; }
        var box = STN.el("results");
        box.innerHTML = "";
        results.forEach(function (r) {
          var btn = document.createElement("button");
          btn.className = "resultBtn";
          btn.textContent = r.display_name;
          btn.addEventListener("click", function () { STN.routing.pick(r); });
          box.appendChild(btn);
        });
        STN.show("results");
      })
      .catch(function () { STN.status("Search failed — check your signal and try again."); });
  },

  pick: function (r) {
    STN.hide("results");
    var dest = [parseFloat(r.lat), parseFloat(r.lon)];
    if (this.destMarker) STN.map.removeLayer(this.destMarker);
    this.destMarker = L.marker(dest).addTo(STN.map)
      .bindPopup(r.display_name.split(",").slice(0, 2).join(","));
    this.route(dest);
  },

  /* ---------- 2. entry point: fetch every weighting, vet each one equally ---------- */
  route: async function (dest) {
    if (!STN.settings.orsKey) {
      STN.openSettings();
      STN.status("Routing needs a free OpenRouteService key — paste it here and save.", 8000);
      return;
    }
    var start = STN._gps.latlng || [STN.map.getCenter().lat, STN.map.getCenter().lng];
    var startLL = [start[1], start[0]];
    var destLL = [dest[1], dest[0]];

    STN.status("Finding truck-safe route options…", 45000);
    try {
      var recommended = await this._fetchRoute([startLL, destLL], this.WEIGHTINGS[0].extra);
      var isLong = recommended.features[0].properties.summary.distance > this.SHORT_MAX_M;

      var options = [];
      for (var i = 0; i < this.WEIGHTINGS.length; i++) {
        var w = this.WEIGHTINGS[i];
        try {
          var baseline = (i === 0) ? recommended : await this._fetchRoute([startLL, destLL], w.extra);
          var opt = isLong
            ? await this._patchLowBridges(baseline.features[0], w.extra)
            : await this._shortRouteLoop(baseline.features[0], startLL, destLL, w.extra);
          opt.label = w.label;
          options.push(opt);
        } catch (e) { /* skip this weighting, the others still stand a chance */ }
      }
      STN.hide("statusMsg");
      this._showOptions(this._dedupe(options));
    } catch (e) {
      if (e.message === "KEY") {
        STN.openSettings();
        STN.status("That routing key was rejected — double-check it and save again.", 8000);
      } else if (e.message === "NETWORK") {
        STN.status("Couldn't reach the routing service — check your signal or Wi-Fi and try again.", 8000);
      } else if (e.message.indexOf("HTTP_") === 0) {
        STN.status("Routing service error (" + e.message.slice(5) + ") — try again shortly.", 8000);
      } else {
        STN.status("Couldn't build a route: " + e.message, 8000);
      }
    }
  },

  /* Weightings that land on the same physical route (common for Recommended
     vs. Fastest, or Avoid Tolls where there's no toll road nearby anyway)
     shouldn't clutter the picker with duplicate buttons. Keeps the first
     (highest-priority) of each near-identical group. */
  _dedupe: function (options) {
    var kept = [];
    options.forEach(function (opt) {
      var isDup = kept.some(function (k) { return Math.abs(k.distanceM - opt.distanceM) < STN.routing.DEDUPE_M; });
      if (!isDup) kept.push(opt);
    });
    return kept;
  },

  /* ---------- ORS request helper ---------- */
  _fetchRoute: async function (coordsLonLat, opts) {
    opts = opts || {};
    var s = STN.settings;
    var body = {
      coordinates: coordsLonLat,
      instructions: false,
      options: {
        profile_params: {
          restrictions: {
            height: +(STN.truckHeightFt() * 0.3048).toFixed(2),
            weight: +(s.weightLbs * 0.000453592).toFixed(2),
            length: +(s.lengthFt * 0.3048).toFixed(2),
            width:  +(s.widthFt  * 0.3048).toFixed(2)
          }
        }
      }
    };
    if (opts.avoidPolygons) body.options.avoid_polygons = opts.avoidPolygons;
    if (opts.avoidFeatures) body.options.avoid_features = opts.avoidFeatures;
    if (opts.preference) body.preference = opts.preference;

    var r;
    try {
      r = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", {
        method: "POST",
        headers: { "Authorization": s.orsKey, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // the request never got a response at all (offline, dropped signal,
      // blocked by a network filter, etc.) — distinct from ORS replying
      // with an error, which is handled below with its own message.
      throw new Error("NETWORK");
    }
    if (r.status === 401 || r.status === 403) throw new Error("KEY");
    var geo;
    try {
      geo = await r.json();
    } catch (e) {
      throw new Error("HTTP_" + r.status);
    }
    if (geo.error) throw new Error(geo.error.message || "routing error");
    if (!r.ok) throw new Error("HTTP_" + r.status);
    return geo;
  },

  /* ---------- SHORT routes: reactive whole-route avoid loop ---------- */
  _shortRouteLoop: async function (initialFeature, startLL, destLL, extra) {
    var avoid = [], seen = {}, feature = initialFeature, attempt = 0;
    while (true) {
      var latlngs = feature.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      var blockers = STN.hazards.nearRoute(latlngs, this.ON_ROUTE_M);
      if (!blockers.length || attempt === this.SHORT_MAX_REROUTES) {
        return this._toOption(latlngs, feature.properties.summary, Object.keys(seen).length, blockers);
      }
      blockers.forEach(function (b) {
        var key = b.lat + "_" + b.lon;
        if (!seen[key]) { seen[key] = 1; avoid.push(STN.routing._boxAround(b)); }
      });
      attempt++;
      try {
        var opts = Object.assign({}, extra, { avoidPolygons: { type: "MultiPolygon", coordinates: avoid } });
        var geo = await this._fetchRoute([startLL, destLL], opts);
        feature = geo.features[0];
      } catch (e) {
        var ll = feature.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        return this._toOption(ll, feature.properties.summary, Object.keys(seen).length,
          STN.hazards.nearRoute(ll, this.ON_ROUTE_M));
      }
    }
  },

  /* Cut a small detour window around each on-route low bridge (or cluster of
     them) and splice it in — sidesteps ORS's whole-route avoid_polygons cap.
     `extra` (this weighting's preference/avoidFeatures) rides along on every
     detour request too, so e.g. an Avoid Tolls option doesn't sneak back onto
     a toll road just to dodge a bridge. */
  _patchLowBridges: async function (baselineFeature, extra) {
    var origCoords = baselineFeature.geometry.coordinates; // [lon,lat]
    var latlngs = origCoords.map(function (c) { return [c[1], c[0]]; });
    var cum = STN.hazards.cumulativeDistancesM(latlngs);
    var hits = STN.hazards.hitsWithIndex(latlngs, this.ON_ROUTE_M);

    if (!hits.length) {
      return this._toOption(latlngs, baselineFeature.properties.summary, 0, []);
    }
    STN.status("Found " + hits.length + " low bridge" + (hits.length > 1 ? "s" : "") +
      " on route — finding local detours…", 90000);

    var clusters = [];
    hits.forEach(function (h) {
      var last = clusters[clusters.length - 1];
      if (last && (cum[h.idx] - cum[last.maxIdx]) <= STN.routing.CLUSTER_GAP_M) {
        last.hits.push(h); last.maxIdx = h.idx;
      } else {
        clusters.push({ hits: [h], minIdx: h.idx, maxIdx: h.idx });
      }
    });

    var segments = [], unavoidable = [], clearedCount = 0, lastExitIdx = -1;

    for (var c = 0; c < clusters.length; c++) {
      var cluster = clusters[c];
      if (cluster.maxIdx <= lastExitIdx) continue; // already inside a previous detour's window
      var result = await this._resolveCluster(cluster, origCoords, cum, lastExitIdx, this.WINDOW_M, extra);
      if (!result.resolved) {
        result = await this._resolveCluster(cluster, origCoords, cum, lastExitIdx, this.WINDOW_BIG_M, extra);
      }
      lastExitIdx = result.exitIdx;
      if (result.resolved) {
        segments.push(result);
        clearedCount += cluster.hits.length;
      } else {
        cluster.hits.forEach(function (h) { unavoidable.push(h.b); });
      }
    }

    var finalLatLngs = [], cursor = 0;
    segments.forEach(function (seg) {
      finalLatLngs = finalLatLngs.concat(latlngs.slice(cursor, seg.startIdx));
      finalLatLngs = finalLatLngs.concat(seg.replacement);
      cursor = seg.endIdx + 1;
    });
    finalLatLngs = finalLatLngs.concat(latlngs.slice(cursor));

    // safety net: re-check the FINAL spliced path in case any detour window
    // ended up subsuming (and silently skipping) a neighboring cluster
    var seenUnavoidable = {};
    unavoidable.forEach(function (b) { seenUnavoidable[b.lat + "_" + b.lon] = 1; });
    STN.hazards.nearRoute(finalLatLngs, this.ON_ROUTE_M).forEach(function (b) {
      var key = b.lat + "_" + b.lon;
      if (!seenUnavoidable[key]) { seenUnavoidable[key] = 1; unavoidable.push(b); }
    });

    var distanceM = STN.routing._haversineTotal(finalLatLngs);
    var pace = baselineFeature.properties.summary.duration / baselineFeature.properties.summary.distance;
    return { coords: finalLatLngs, distanceM: distanceM, durationS: distanceM * pace,
      clearedCount: clearedCount, unavoidable: unavoidable };
  },

  /* Try to route the small window [entry..exit] around a cluster of bridges.
     Returns {resolved:false, entryIdx, exitIdx} if it still can't be avoided —
     entryIdx/exitIdx are still reported so the caller can fence off this zone
     from the next cluster's window. */
  _resolveCluster: async function (cluster, origCoords, cum, lastExitIdx, windowM, extra) {
    var entryIdx = cluster.minIdx;
    while (entryIdx > 0 && (cum[cluster.minIdx] - cum[entryIdx]) < windowM) entryIdx--;
    if (entryIdx <= lastExitIdx) entryIdx = Math.min(cluster.minIdx - 1, lastExitIdx + 1);
    if (entryIdx < 0) entryIdx = 0;

    var exitIdx = cluster.maxIdx;
    while (exitIdx < cum.length - 1 && (cum[exitIdx] - cum[cluster.maxIdx]) < windowM) exitIdx++;

    var avoidBoxes = cluster.hits.map(function (h) { return STN.routing._boxAround(h.b); });
    try {
      var opts = Object.assign({}, extra, { avoidPolygons: { type: "MultiPolygon", coordinates: avoidBoxes } });
      var geo = await STN.routing._fetchRoute([origCoords[entryIdx], origCoords[exitIdx]], opts);
      var subLatLngs = geo.features[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      if (STN.hazards.nearRoute(subLatLngs, STN.routing.ON_ROUTE_M).length) {
        return { resolved: false, entryIdx: entryIdx, exitIdx: exitIdx };
      }
      return {
        resolved: true, entryIdx: entryIdx, exitIdx: exitIdx,
        startIdx: entryIdx, endIdx: exitIdx, replacement: subLatLngs
      };
    } catch (e) {
      return { resolved: false, entryIdx: entryIdx, exitIdx: exitIdx };
    }
  },

  _haversineTotal: function (line) {
    var R = 6371000, toRad = Math.PI / 180, total = 0;
    for (var i = 1; i < line.length; i++) {
      var lat1 = line[i - 1][0], lon1 = line[i - 1][1], lat2 = line[i][0], lon2 = line[i][1];
      var dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return total;
  },

  _toOption: function (coordsLatLng, summary, clearedCount, unavoidable) {
    return { coords: coordsLatLng, distanceM: summary.distance, durationS: summary.duration,
      clearedCount: clearedCount, unavoidable: unavoidable };
  },

  /* ~60 m square around a bridge, as a GeoJSON polygon ring (lon,lat order) */
  _boxAround: function (b) {
    var dLat = 60 / 111320;
    var dLon = 60 / (111320 * Math.cos(b.lat * Math.PI / 180));
    return [[
      [b.lon - dLon, b.lat - dLat], [b.lon + dLon, b.lat - dLat],
      [b.lon + dLon, b.lat + dLat], [b.lon - dLon, b.lat + dLat],
      [b.lon - dLon, b.lat - dLat]
    ]];
  },

  /* ---------- 3. show up to 4 options, then draw whichever is picked ---------- */
  _showOptions: function (options) {
    if (options.length <= 1) { this.draw(options[0]); return; }
    var box = STN.el("routeOptions");
    box.innerHTML = "";
    options.forEach(function (opt) {
      var miles = (opt.distanceM / 1609.34).toFixed(0);
      var hh = Math.floor(opt.durationS / 3600), mm = Math.round((opt.durationS % 3600) / 60);
      var status = opt.unavoidable.length
        ? "⛔ " + opt.unavoidable.length + " unavoidable low bridge" + (opt.unavoidable.length > 1 ? "s" : "")
        : (STN.hazards.nearRoute(opt.coords, STN.routing.NEARBY_M).length ? "⚠️ low bridges nearby" : "✅ no known low bridges");
      var btn = document.createElement("button");
      btn.className = "resultBtn";
      btn.innerHTML = "<b>" + opt.label + "</b> — " + miles + " mi · " + hh + "h " + mm + "m<br>" + status;
      btn.addEventListener("click", function () { STN.hide("routeOptions"); STN.routing.draw(opt); });
      box.appendChild(btn);
    });
    STN.show("routeOptions");
  },

  draw: function (option) {
    this.clear(true);

    this.routeLayer = L.polyline(option.coords, { color: "#1e78ff", weight: 7, opacity: 0.85 }).addTo(STN.map);
    STN.map.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });

    var miles = (option.distanceM / 1609.34).toFixed(0);
    var h = Math.floor(option.durationS / 3600), m = Math.round((option.durationS % 3600) / 60);
    STN.el("routeSummary").textContent = (option.label ? option.label + ": " : "") +
      "🛣 " + miles + " mi · " + h + "h " + m + "m";
    STN.show("routeInfo");

    var banner = STN.el("hazardBanner");
    banner.classList.remove("caution");

    if (option.unavoidable.length) {
      var lowest = option.unavoidable.slice().sort(function (a, b) { return a.h - b.h; })[0];
      var triedMi = Math.round(this.WINDOW_BIG_M / 1609.34);
      banner.innerHTML = "⛔ " + option.unavoidable.length + " low bridge" +
        (option.unavoidable.length > 1 ? "s" : "") + " on this route couldn't be routed around " +
        "(tried local detours up to " + triedMi + " mi wide) — that's likely the only through-road there. " +
        "Lowest: " + STN.fmtHeight(lowest.h) + ". You'll need to plan that stretch yourself.";
      STN.show("hazardBanner");
      return;
    }

    var nearby = STN.hazards.nearRoute(option.coords, this.NEARBY_M);
    if (nearby.length) {
      banner.classList.add("caution");
      banner.innerHTML = "⚠️ " + (option.clearedCount ? "Rerouted around " + option.clearedCount +
        " low bridge" + (option.clearedCount > 1 ? "s" : "") + ". " : "") +
        nearby.length + " more within a block of the route (lowest " + STN.fmtHeight(nearby[0].h) +
        ") — stay on the blue line.";
      STN.show("hazardBanner");
    } else {
      STN.hide("hazardBanner");
      if (option.clearedCount) {
        STN.status("✓ Rerouted around " + option.clearedCount + " low bridge" +
          (option.clearedCount > 1 ? "s" : "") + ". No more known low bridges on this route.", 6000);
      }
    }
  },

  clear: function (keepDest) {
    if (this.routeLayer) { STN.map.removeLayer(this.routeLayer); this.routeLayer = null; }
    if (!keepDest && this.destMarker) { STN.map.removeLayer(this.destMarker); this.destMarker = null; }
    STN.hide("routeInfo");
    STN.hide("hazardBanner");
    STN.hide("routeOptions");
  }
};
