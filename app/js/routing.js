/* STN routing: address search (Nominatim, free) + truck-safe route (OpenRouteService) */

STN.routing = {
  routeLayer: null,
  destMarker: null,

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

  /* ---------- 2. get a truck-safe route ---------- */
  route: function (dest) {
    if (!STN.settings.orsKey) {
      STN.openSettings();
      STN.status("Routing needs a free OpenRouteService key — paste it here and save.", 8000);
      return;
    }
    var start = STN._gps.latlng || [STN.map.getCenter().lat, STN.map.getCenter().lng];
    STN.status("Finding a truck-safe route…", 30000);

    var s = STN.settings;
    var body = {
      coordinates: [[start[1], start[0]], [dest[1], dest[0]]],  // ORS wants lon,lat
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
        STN.hide("statusMsg");
        STN.routing.draw(geo);
      })
      .catch(function (e) {
        if (e.message === "KEY") {
          STN.openSettings();
          STN.status("That routing key was rejected — double-check it and save again.", 8000);
        } else {
          STN.status("Couldn't build a route: " + e.message, 8000);
        }
      });
  },

  /* ---------- 3. draw it + check for low bridges ---------- */
  draw: function (geo) {
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

    // safety pass: any too-low bridges within ~100 m of this route?
    var coords = geo.features[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
    var hits = STN.hazards.nearRoute(coords);
    var banner = STN.el("hazardBanner");
    if (hits.length) {
      var lowest = hits[0];
      banner.innerHTML = "⚠️ " + hits.length + " low bridge" + (hits.length > 1 ? "s" : "") +
        " near this route — lowest " + STN.fmtHeight(lowest.h) +
        ". Zoom in on red dots before you commit.";
      STN.show("hazardBanner");
    } else {
      banner.innerHTML = "";
      STN.hide("hazardBanner");
    }
  },

  clear: function (keepDest) {
    if (this.routeLayer) { STN.map.removeLayer(this.routeLayer); this.routeLayer = null; }
    if (!keepDest && this.destMarker) { STN.map.removeLayer(this.destMarker); this.destMarker = null; }
    STN.hide("routeInfo");
    STN.hide("hazardBanner");
  }
};
