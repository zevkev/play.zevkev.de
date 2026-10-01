// play.zevkev.de – Live-Status, IP kopieren, Hell/Dunkel, Einblenden beim Scrollen.
(function () {
  "use strict";

  // Der Status-Dienst löst play.zevkev.de selbst über den SRV-Eintrag auf; die DatHost-Adresse ist die Rückfallebene.
  var STATUS_URLS = [
    "https://api.mcstatus.io/v2/status/java/play.zevkev.de",
    "https://api.mcstatus.io/v2/status/java/jurassiccraft.dat.airforce:17161"
  ];
  var REFRESH_MS = 60000;

  // Live-Karte (squaremap auf dem Spielserver). Browser blockieren eine unverschlüsselte (http) Seite in einer
  // https-Seite. Sobald die Karte eine https-Adresse hat (z. B. über einen Cloudflare-Worker), hier eintragen –
  // dann läuft sie direkt auf der Website. Bis dahin öffnet sie sich in einem neuen Tab.
  var MAP_SECURE_URL = "";
  var MAP_DIRECT_URL = "http://map.zevkev.de:17165/";
  var MAP_SLEEP_MS = 120000; // Karte im Hintergrund-Tab nach 2 Minuten anhalten (spart Abfragen)

  // ── Hell/Dunkel ───────────────────────────────────────────────────────────
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("zevkev-theme", next); } catch (e) { /* privater Modus */ }
    });
  }

  // ── IP kopieren ───────────────────────────────────────────────────────────
  document.querySelectorAll("[data-copy]").forEach(function (button) {
    var label = button.querySelector(".copy-label");
    button.addEventListener("click", function () {
      var text = button.getAttribute("data-copy");
      var done = function () {
        button.classList.add("is-copied");
        if (label) label.textContent = "Kopiert!";
        setTimeout(function () {
          button.classList.remove("is-copied");
          if (label) label.textContent = "Kopieren";
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { selectIp(); });
      } else {
        selectIp();
      }
    });
  });

  function selectIp() {
    var ip = document.getElementById("server-ip");
    if (!ip) return;
    var range = document.createRange();
    range.selectNodeContents(ip);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // ── Einblenden ────────────────────────────────────────────────────────────
  var revealed = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealed.forEach(function (el) { observer.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // ── Live-Karte: einbetten, Vollbild, zurück zur Website ───────────────────
  function mapUrl() {
    if (MAP_SECURE_URL) return MAP_SECURE_URL;
    return location.protocol === "https:" ? "" : MAP_DIRECT_URL;
  }

  function openDirect() {
    window.open(MAP_DIRECT_URL, "_blank", "noopener");
  }

  function makeFrame(src) {
    var frame = document.createElement("iframe");
    frame.className = "map-iframe";
    frame.src = src;
    frame.title = "ZEVKEV Live-Karte";
    frame.setAttribute("allow", "fullscreen");
    frame.setAttribute("referrerpolicy", "no-referrer");
    return frame;
  }

  var embed = document.getElementById("map-embed");
  var overlay = document.getElementById("map-overlay");
  var inlineFrame = null;

  function loadInline() {
    if (inlineFrame || !mapUrl()) return;
    inlineFrame = makeFrame(mapUrl());
    embed.querySelector(".map-stage").appendChild(inlineFrame);
    embed.classList.add("is-live");
  }

  function openOverlay() {
    var src = mapUrl();
    if (!src) { openDirect(); return; }
    if (!overlay) return;
    var stage = overlay.querySelector(".map-overlay-stage");
    if (!stage.querySelector("iframe")) stage.appendChild(makeFrame(src));
    if (inlineFrame) inlineFrame.src = "about:blank"; // nicht doppelt laden
    overlay.hidden = false;
    document.body.classList.add("map-open");
    var back = overlay.querySelector("[data-map='close']");
    if (back) back.focus();
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(function () { /* Fenster füllt trotzdem */ });
  }

  function closeOverlay() {
    if (!overlay || overlay.hidden) return;
    var frame = overlay.querySelector("iframe");
    if (frame) frame.remove();
    overlay.hidden = true;
    document.body.classList.remove("map-open");
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    if (inlineFrame) inlineFrame.src = mapUrl();
    var section = document.getElementById("karte");
    if (section) section.scrollIntoView({ block: "start" });
  }

  if (embed) {
    var openLink = embed.querySelector("[data-map='open']");
    var fullButton = embed.querySelector("[data-map='full']");
    if (mapUrl()) {
      // Karte lädt von selbst, sobald man in ihre Nähe scrollt (nicht schon beim Seitenaufruf)
      if (openLink) openLink.hidden = true;
      if ("IntersectionObserver" in window) {
        var mapObserver = new IntersectionObserver(function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) {
            loadInline();
            mapObserver.disconnect();
          }
        }, { rootMargin: "600px 0px" });
        mapObserver.observe(embed);
      } else {
        loadInline();
      }
    } else if (fullButton) {
      fullButton.hidden = true; // ohne https-Adresse geht die Karte nur im eigenen Tab
    }
    if (fullButton) fullButton.addEventListener("click", openOverlay);
  }
  if (overlay) {
    overlay.addEventListener("click", function (event) {
      if (event.target.closest("[data-map='close']")) closeOverlay();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !overlay.hidden) closeOverlay();
    });
    // Browser-Vollbild mit Esc beendet → auch die Karte schließen und zurück zur Website
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && !overlay.hidden) closeOverlay();
    });
  }

  // Eigene Kartenseite /map/: Karte füllt das Fenster, oben die Leiste mit "Zurück zur Website"
  var mapPage = document.getElementById("map-page");
  if (mapPage && mapUrl()) {
    var pageStage = mapPage.querySelector(".map-overlay-stage");
    pageStage.innerHTML = "";
    pageStage.appendChild(makeFrame(mapUrl()));
    var fullButton = mapPage.querySelector("[data-map='fullscreen']");
    if (fullButton && mapPage.requestFullscreen) {
      fullButton.hidden = false;
      fullButton.addEventListener("click", function () {
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        else mapPage.requestFullscreen().catch(function () {});
      });
    }
  }

  // Im Hintergrund-Tab anhalten, beim Zurückkommen neu laden
  var sleepTimer = null;
  document.addEventListener("visibilitychange", function () {
    var frames = document.querySelectorAll(".map-iframe");
    if (!frames.length) return;
    if (document.hidden) {
      sleepTimer = setTimeout(function () {
        frames.forEach(function (frame) { frame.dataset.sleeping = frame.src; frame.src = "about:blank"; });
      }, MAP_SLEEP_MS);
    } else {
      clearTimeout(sleepTimer);
      frames.forEach(function (frame) {
        if (frame.dataset.sleeping) { frame.src = frame.dataset.sleeping; delete frame.dataset.sleeping; }
      });
    }
  });

  // ── Live-Status ───────────────────────────────────────────────────────────
  var statusBox = document.getElementById("status");
  var statusText = statusBox ? statusBox.querySelector(".status-text") : null;
  var playerList = document.getElementById("player-list");

  function fetchStatus(index) {
    return fetch(STATUS_URLS[index], { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data.online && index + 1 < STATUS_URLS.length) return fetchStatus(index + 1);
        return data;
      })
      .catch(function (error) {
        if (index + 1 < STATUS_URLS.length) return fetchStatus(index + 1);
        throw error;
      });
  }

  function versionLabel(data) {
    var raw = (data.version && (data.version.name_clean || data.version.name_raw)) || "";
    var match = raw.match(/\d+(\.\d+)+/);
    return match ? "Java " + match[0] : "";
  }

  function render(data) {
    if (!statusBox) return;
    statusBox.classList.remove("is-online", "is-offline");
    if (!data || !data.online) {
      statusBox.classList.add("is-offline");
      statusText.textContent = "Server gerade offline";
      playerList.innerHTML = "";
      return;
    }
    var online = data.players ? data.players.online : 0;
    var max = data.players ? data.players.max : 0;
    var parts = ["Online", online + (max ? " / " + max : "") + " Spieler"];
    var version = versionLabel(data);
    if (version) parts.push(version);
    statusBox.classList.add("is-online");
    // Trenner als gezeichnete Punkte – manche installierte Schriften haben für "·" ein leeres Zeichen
    statusText.textContent = "";
    parts.forEach(function (part, i) {
      if (i > 0) {
        var sep = document.createElement("span");
        sep.className = "sep";
        sep.setAttribute("aria-hidden", "true");
        statusText.appendChild(sep);
      }
      var chunk = document.createElement("span");
      chunk.className = "nowrap";
      chunk.textContent = part;
      statusText.appendChild(chunk);
    });

    playerList.innerHTML = "";
    var names = (data.players && data.players.list) || [];
    if (names.length) {
      names.slice(0, 24).forEach(function (player) {
        var li = document.createElement("li");
        li.textContent = player.name_clean || player.name_raw || "";
        playerList.appendChild(li);
      });
    } else if (online === 0) {
      var empty = document.createElement("li");
      empty.className = "is-empty";
      empty.textContent = "Gerade ist niemand online – sei der Erste!";
      playerList.appendChild(empty);
    }
  }

  function refresh() {
    fetchStatus(0).then(render).catch(function () {
      if (statusText) statusText.textContent = "Status gerade nicht abrufbar";
    });
  }

  if (statusBox) {
    refresh();
    setInterval(function () { if (!document.hidden) refresh(); }, REFRESH_MS);
  }
})();
