/* STN hazards: low-bridge dots + "is my route safe?" check
   Data: app/data/low_bridges.geojson — every OSM-tagged height limit under 16 ft
   in TX / OK / LA / AR / NM, pre-downloaded so it works instantly (and offline). */

STN.hazards = {
  all: [],          // [{lat, lon, h(ft), raw, name, st}]
  layer: null,

  load: function () {
    fetch("data/low_bridges.geojson")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (geo) {
        STN.hazards.all = geo.features.map(function (f) {
          var p = f.properties;
          return {
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            h: p.h, raw: p.raw, name: p.name || "", st: p.st
          };
        });
        STN.hazards.refresh();
      })
      .catch(function (e) {
        STN.status("Couldn't load bridge data (" + e.message + "). Routing still works.");
      });
  },

  /* Draw every bridge that matters for THIS truck: anything lower than
     truck height + 1 ft of breathing room. Red = won't fit, orange = tight. */
  refresh: function () {
    if (this.layer) { STN.map.removeLayer(this.layer); this.layer = null; }
    if (!this.all.length || !STN.map) return;

    var truckH = STN.truckHeightFt();
    var showBelow = truckH + 1.0;
    var group = L.layerGroup();

    this.all.forEach(function (b) {
      if (b.h >= showBelow) return;
      var fits = b.h > truckH + 0.24;              // ~3 in of margin
      var m = L.circleMarker([b.lat, b.lon], {
        radius: fits ? 6 : 8,
        color: "#fff", weight: 1.5,
        fillColor: fits ? "#f59e0b" : "#dc2626",
        fillOpacity: 0.95
      });
      m.bindPopup(
        '<div class="bridgePopup">' +
        (fits ? "⚠️ TIGHT CLEARANCE" : "⛔ TOO LOW FOR YOUR TRUCK") +
        '<br><span class="h">' + STN.fmtHeight(b.h) + "</span> posted" +
        (b.name ? "<br>" + b.name : "") +
        "</div>"
      );
      group.addLayer(m);
    });

    this.layer = group.addTo(STN.map);
  },

  /* Which bridges lower than the truck sit within radiusM of the route line?
     Returns them sorted lowest-first. */
  nearRoute: function (routeLatLngs, radiusM) {
    radiusM = radiusM || 100;
    var truckH = STN.truckHeightFt();
    var dangerous = this.all.filter(function (b) { return b.h <= truckH + 0.24; });
    if (!dangerous.length || routeLatLngs.length < 2) return [];

    // rough bounding box around the route, padded ~0.03° (≈2 miles)
    var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    routeLatLngs.forEach(function (p) {
      if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
      if (p[1] < minLon) minLon = p[1]; if (p[1] > maxLon) maxLon = p[1];
    });
    minLat -= 0.03; maxLat += 0.03; minLon -= 0.03; maxLon += 0.03;

    var hits = [];
    dangerous.forEach(function (b) {
      if (b.lat < minLat || b.lat > maxLat || b.lon < minLon || b.lon > maxLon) return;
      if (STN.hazards._distToLineM(b, routeLatLngs) <= radiusM) hits.push(b);
    });
    hits.sort(function (a, c) { return a.h - c.h; });
    return hits;
  },

  /* Minimum distance (meters) from a point to the route polyline.
     Uses a flat-earth approximation — plenty accurate at 100 m scale. */
  _distToLineM: function (b, line) {
    return this._nearestOnLine(b, line).distM;
  },

  /* Same search as _distToLineM, but also reports WHICH point along the route
     line is closest — needed to know where along a long route a bridge sits,
     so routing.js can cut a small local detour window around just that spot. */
  _nearestOnLine: function (b, line) {
    var mPerDegLat = 111320;
    var mPerDegLon = 111320 * Math.cos(b.lat * Math.PI / 180);
    var px = b.lon * mPerDegLon, py = b.lat * mPerDegLat;
    var best = Infinity, bestIdx = 0;

    for (var i = 0; i < line.length - 1; i++) {
      var ax = line[i][1] * mPerDegLon,     ay = line[i][0] * mPerDegLat;
      var bx = line[i + 1][1] * mPerDegLon, by = line[i + 1][0] * mPerDegLat;
      var dx = bx - ax, dy = by - ay;
      var t = dx === 0 && dy === 0 ? 0 :
        Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
      var ex = ax + t * dx - px, ey = ay + t * dy - py;
      var d = Math.sqrt(ex * ex + ey * ey);
      if (d < best) { best = d; bestIdx = t < 0.5 ? i : i + 1; }
    }
    return { distM: best, idx: bestIdx };
  },

  /* Like nearRoute, but each hit also carries the route-array index nearest
     it, sorted by that position. Used to place local detour windows. */
  hitsWithIndex: function (routeLatLngs, radiusM) {
    var truckH = STN.truckHeightFt();
    var dangerous = this.all.filter(function (b) { return b.h <= truckH + 0.24; });
    if (!dangerous.length || routeLatLngs.length < 2) return [];

    var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    routeLatLngs.forEach(function (p) {
      if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
      if (p[1] < minLon) minLon = p[1]; if (p[1] > maxLon) maxLon = p[1];
    });
    minLat -= 0.03; maxLat += 0.03; minLon -= 0.03; maxLon += 0.03;

    var hits = [];
    dangerous.forEach(function (b) {
      if (b.lat < minLat || b.lat > maxLat || b.lon < minLon || b.lon > maxLon) return;
      var info = STN.hazards._nearestOnLine(b, routeLatLngs);
      if (info.distM <= radiusM) hits.push({ b: b, idx: info.idx, distM: info.distM });
    });
    hits.sort(function (a, c) { return a.idx - c.idx; });
    return hits;
  },

  /* Cumulative distance (meters) from the start to each point on the route —
     real haversine, since local-detour windows need to stay accurate over
     routes that span hundreds of miles (a fixed flat-earth factor would drift). */
  cumulativeDistancesM: function (line) {
    var R = 6371000, toRad = Math.PI / 180;
    var cum = [0];
    for (var i = 1; i < line.length; i++) {
      var lat1 = line[i - 1][0], lon1 = line[i - 1][1], lat2 = line[i][0], lon2 = line[i][1];
      var dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      cum.push(cum[i - 1] + R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }
    return cum;
  }
};
