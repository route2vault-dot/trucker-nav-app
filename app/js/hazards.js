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

  /* After a route is drawn: which bridges lower than the truck sit within
     ~100 m of the route line? Returns them sorted lowest-first. */
  nearRoute: function (routeLatLngs) {
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
      if (STN.hazards._distToLineM(b, routeLatLngs) <= 100) hits.push(b);
    });
    hits.sort(function (a, c) { return a.h - c.h; });
    return hits;
  },

  /* Minimum distance (meters) from a point to the route polyline.
     Uses a flat-earth approximation — plenty accurate at 100 m scale. */
  _distToLineM: function (b, line) {
    var mPerDegLat = 111320;
    var mPerDegLon = 111320 * Math.cos(b.lat * Math.PI / 180);
    var px = b.lon * mPerDegLon, py = b.lat * mPerDegLat;
    var best = Infinity;

    for (var i = 0; i < line.length - 1; i++) {
      var ax = line[i][1] * mPerDegLon,     ay = line[i][0] * mPerDegLat;
      var bx = line[i + 1][1] * mPerDegLon, by = line[i + 1][0] * mPerDegLat;
      var dx = bx - ax, dy = by - ay;
      var t = dx === 0 && dy === 0 ? 0 :
        Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
      var ex = ax + t * dx - px, ey = ay + t * dy - py;
      var d = Math.sqrt(ex * ex + ey * ey);
      if (d < best) best = d;
    }
    return best;
  }
};
