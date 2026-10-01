// play.zevkev.de – Live-Status, IP kopieren, Hell/Dunkel, Einblenden beim Scrollen.
(function () {
  "use strict";

  // Der Status-Dienst löst play.zevkev.de selbst über den SRV-Eintrag auf; die DatHost-Adresse ist die Rückfallebene.
  var STATUS_URLS = [
    "https://api.mcstatus.io/v2/status/java/play.zevkev.de",
    "https://api.mcstatus.io/v2/status/java/jurassiccraft.dat.airforce:17161"
  ];
  var REFRESH_MS = 60000;

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
