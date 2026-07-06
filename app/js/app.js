/* STN core: settings, shared helpers, app startup */

var STN = {
  // filled in by map.js / hazards.js / routing.js
  map: null,

  DEFAULTS: {
    heightFt: 13, heightIn: 6,   // 13'6" standard trailer
    weightLbs: 80000,            // federal max gross
    lengthFt: 70,
    widthFt: 8.5,
    orsKey: ""
  },

  settings: null,

  loadSettings: function () {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("stn_settings") || "{}"); } catch (e) {}
    this.settings = Object.assign({}, this.DEFAULTS, saved);
    // an optional js/config.js can pre-fill the routing key
    if (!this.settings.orsKey && window.STN_CONFIG && window.STN_CONFIG.orsKey) {
      this.settings.orsKey = window.STN_CONFIG.orsKey;
    }
  },

  saveSettings: function () {
    localStorage.setItem("stn_settings", JSON.stringify(this.settings));
  },

  truckHeightFt: function () {
    return this.settings.heightFt + this.settings.heightIn / 12;
  },

  /* ---------- tiny UI helpers ---------- */
  el: function (id) { return document.getElementById(id); },

  show: function (id) { this.el(id).classList.remove("hidden"); },
  hide: function (id) { this.el(id).classList.add("hidden"); },

  status: function (msg, ms) {
    var box = this.el("statusMsg");
    box.textContent = msg;
    box.classList.remove("hidden");
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(function () { box.classList.add("hidden"); }, ms || 4000);
  },

  fmtHeight: function (ft) {
    var whole = Math.floor(ft);
    var inches = Math.round((ft - whole) * 12);
    if (inches === 12) { whole += 1; inches = 0; }
    return whole + "'" + inches + '"';
  },

  /* ---------- settings panel ---------- */
  openSettings: function () {
    var s = this.settings;
    this.el("setHeightFt").value = s.heightFt;
    this.el("setHeightIn").value = s.heightIn;
    this.el("setWeight").value = s.weightLbs;
    this.el("setLength").value = s.lengthFt;
    this.el("setWidth").value = s.widthFt;
    this.el("setOrsKey").value = s.orsKey;
    this.hide("results");
    this.show("settings");
  },

  applySettings: function () {
    var s = this.settings;
    s.heightFt = parseInt(this.el("setHeightFt").value, 10) || this.DEFAULTS.heightFt;
    s.heightIn = parseInt(this.el("setHeightIn").value, 10) || 0;
    s.weightLbs = parseInt(this.el("setWeight").value, 10) || this.DEFAULTS.weightLbs;
    s.lengthFt = parseFloat(this.el("setLength").value) || this.DEFAULTS.lengthFt;
    s.widthFt = parseFloat(this.el("setWidth").value) || this.DEFAULTS.widthFt;
    s.orsKey = this.el("setOrsKey").value.trim();
    this.saveSettings();
    this.hide("settings");
    STN.hazards.refresh();           // re-color bridges for new truck height
    this.status("Saved. Truck height " + this.fmtHeight(this.truckHeightFt()));
  },

  toggleNight: function () {
    document.body.classList.toggle("night");
    localStorage.setItem("stn_night", document.body.classList.contains("night") ? "1" : "");
  },

  /* ---------- startup ---------- */
  start: function () {
    this.loadSettings();
    if (localStorage.getItem("stn_night")) document.body.classList.add("night");

    STN.mapInit();
    STN.hazards.load();

    var self = this;
    this.el("settingsBtn").addEventListener("click", function () { self.openSettings(); });
    this.el("saveSettingsBtn").addEventListener("click", function () { self.applySettings(); });
    this.el("nightBtn").addEventListener("click", function () { self.toggleNight(); });
    this.el("locateBtn").addEventListener("click", function () { STN.locate(); });
    this.el("goBtn").addEventListener("click", function () { STN.routing.search(); });
    this.el("dest").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.target.blur(); STN.routing.search(); }
    });
    this.el("clearRouteBtn").addEventListener("click", function () { STN.routing.clear(); });

    // first-run nudge if there is no routing key yet
    if (!this.settings.orsKey) {
      this.status("Tap ⚙️ and paste your free OpenRouteService key to enable routing.", 8000);
    }
  }
};
