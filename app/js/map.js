/* STN map: Leaflet setup + live GPS blue dot */

STN.mapInit = function () {
  // Center of the 5-state corridor (roughly Dallas–Fort Worth), zoomed out
  STN.map = L.map("map", {
    preferCanvas: true,          // canvas handles thousands of bridge dots smoothly
    zoomControl: false
  }).setView([32.9, -97.0], 6);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(STN.map);

  L.control.zoom({ position: "bottomleft" }).addTo(STN.map);

  STN._gps = { marker: null, ring: null, latlng: null, watching: false };
  STN.watchGPS();
};

/* Continuously track the driver's position (blue dot + accuracy ring) */
STN.watchGPS = function () {
  if (!("geolocation" in navigator) || STN._gps.watching) return;
  STN._gps.watching = true;

  navigator.geolocation.watchPosition(
    function (pos) {
      var ll = [pos.coords.latitude, pos.coords.longitude];
      STN._gps.latlng = ll;
      if (!STN._gps.marker) {
        STN._gps.ring = L.circle(ll, {
          radius: pos.coords.accuracy || 30,
          color: "#1e78ff", weight: 1, fillColor: "#1e78ff", fillOpacity: 0.12
        }).addTo(STN.map);
        STN._gps.marker = L.circleMarker(ll, {
          radius: 9, color: "#fff", weight: 3, fillColor: "#1e78ff", fillOpacity: 1
        }).addTo(STN.map);
      } else {
        STN._gps.marker.setLatLng(ll);
        STN._gps.ring.setLatLng(ll).setRadius(pos.coords.accuracy || 30);
      }
    },
    function (err) {
      // Permission denied or no signal — the app still works from the map view
      console.warn("GPS:", err.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
};

/* 📍 button: jump to current position */
STN.locate = function () {
  if (STN._gps.latlng) {
    STN.map.setView(STN._gps.latlng, Math.max(STN.map.getZoom(), 13));
  } else if (!("geolocation" in navigator)) {
    STN.status("This phone/browser has no location service.");
  } else {
    STN.status("Waiting for GPS… make sure location is allowed.");
    STN.watchGPS();
  }
};
