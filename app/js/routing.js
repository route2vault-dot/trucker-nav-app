/* STN routing: address search (Nominatim, free) + truck-safe route (OpenRouteService)

   Low-bridge avoidance: ORS's driving-hgv profile respects height limits only
   where ITS map data has them tagged — which misses some. So after every route
   comes back we check it against our own bridge database; any too-low bridge
   sitting ON the route gets wrapped in a small avoid_polygons box and the
   route is re-requested. Repeats up to 4 times, then warns if still blocked. */

STN.routing = {
  routeLayer: null,
  destMarker: null,

  MAX_REROUTES: 4,
  ON_ROUTE_M: 30,     // bridge within this distance = we'd drive under it
  NEARBY_M: 100,      // bridge within this distance = worth a caution note

  /* ---------- 1. search the destination ---------- */
  search: function () {
    var q = STN.el("dest").value.trim();
    if (!q) { STN.status("Type a destination first."); return; }
    STN.status("Searching…", 15000);

    // bias results to the 5-state corridor
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

  /* ---------- 2. truck-safe route with low-bridge avoidance ---------- */
  route: function (dest) {
    if (!STN.settings.orsKey) {
      STN.openSettings();
      STN.status("Routing needs a free OpenRouteService key — paste it here and save.", 8000);
      return;
    }
    this._dest = dest;
    this._start = STN._gps.latlng || [STN.map.getCenter().lat, STN.map.getCenter().lng];
    this._avoid = [];        // one small polygon per bridge we're steering around
    this._attempt = 0;
    this._fallback = null;   // best route so far, if avoiding ends up impossible
    STN.status("Finding a truck-safe route…", 30000);
    this._request();
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

  _toLatLngs: function (geo) {
    return geo.features[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
  },

  _request: function () {
    var s = STN.settings, self = this;
    var body = {
      coordinates: [[this._start[1], this._start[0]], [this._dest[1], this._dest[0]]],
      instructions: false,
      options: {
        profile_params: {
          restrictions: {
            height: +(STN.truckHeightFt() * 0.3048).toFixed(2),  // feet → meters
            weight: +(s.weightLbs * 0.000453592).toFixed(2),     // lbs → metric tons
            length: +(s.lengthFt * 0.3048).toFixed(2),
            width:  +(s.widthFt  * 0.3048).toFixed(2)
          }
        }
      }
    };
    if (this._avoid.length) {
      body.options.avoid_polygons = { type: "MultiPolygon", coordinates: this._avoid };
    }

    fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", {
      method: "POST",
      headers: { "Authorization": s.orsKey, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("KEY");
        return r.json();
      })
      .then(function (geo) {
        if (geo.error) throw new Error(geo.error.message || "routing error");

        var blockers = STN.hazards.nearRoute(self._toLatLngs(geo), self.ON_ROUTE_M);
        if (blockers.length && self._attempt < self.MAX_REROUTES) {
          // too-low bridge on the route — box it off and ask again
          self._attempt++;
          self._fallback = geo;
          blockers.forEach(function (b) { self._avoid.push(self._boxAround(b)); });
          STN.status("Low bridge on route (" + STN.fmtHeight(blockers[0].h) +
            ") — finding a way around… (" + self._attempt + ")", 30000);
          self._request();
          return;
        }
        STN.hide("statusMsg");
        self.draw(geo, blockers);
      })
      .catch(function (e) {
        if (e.message === "KEY") {
          STN.openSettings();
          STN.status("That routing key was rejected — double-check it and save again.", 8000);
        } else if (self._fallback) {
          // ORS couldn't route around the boxes (e.g. only one road in) —
          // show the best route we had and be loud about the danger on it
          self.draw(self._fallback, STN.hazards.nearRoute(self._toLatLngs(self._fallback), self.ON_ROUTE_M));
        } else {
          STN.status("Couldn't build a route: " + e.message, 8000);
        }
      });
  },

  /* ---------- 3. draw it + report what the avoidance pass did ---------- */
  draw: function (geo, blockers) {
    this.clear(true);

    this.routeLayer = L.geoJSON(geo, {
      style: { color: "#1e78ff", weight: 7, opacity: 0.85 }
    }).addTo(STN.map);
    STN.map.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });

    var sum = geo.features[0].properties.summary;
    var miles = (sum.distance / 1609.34).toFixed(0);
    var h = Math.floor(sum.duration / 3600), m = Math.round((sum.duration % 3600) / 60);
    STN.el("routeSummary").textContent = "🛣 " + miles + " mi · " + h + "h " + m + "m";
    STN.show("routeInfo");

    var banner = STN.el("hazardBanner");
    banner.classList.remove("caution");
    var rerouted = this._avoid.length;

    if (blockers && blockers.length) {
      // avoidance failed — this route still goes under something too low
      banner.innerHTML = "⛔ " + blockers.length + " low bridge" + (blockers.length > 1 ? "s" : "") +
        " ON this route — lowest " + STN.fmtHeight(blockers[0].h) +
        ". No way around found. Zoom the red dots and plan that stretch yourself.";
      STN.show("hazardBanner");
      return;
    }

    var nearby = STN.hazards.nearRoute(this._toLatLngs(geo), this.NEARBY_M);
    if (nearby.length) {
      banner.classList.add("caution");
      banner.innerHTML = "⚠️ " + (rerouted ? "Rerouted around " + rerouted + " low bridge" + (rerouted > 1 ? "s" : "") + ". " : "") +
        nearby.length + " more within a block of the route (lowest " + STN.fmtHeight(nearby[0].h) +
        ") — stay on the blue line.";
      STN.show("hazardBanner");
    } else {
      STN.hide("hazardBanner");
      if (rerouted) STN.status("✓ Rerouted around " + rerouted + " low bridge" + (rerouted > 1 ? "s" : "") + ". Route is clear.", 6000);
    }
  },

  clear: function (keepDest) {
    if (this.routeLayer) { STN.map.removeLayer(this.routeLayer); this.routeLayer = null; }
    if (!keepDest && this.destMarker) { STN.map.removeLayer(this.destMarker); this.destMarker = null; }
    STN.hide("routeInfo");
    STN.hide("hazardBanner");
  }
};
