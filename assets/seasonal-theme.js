(function (window, document) {
  "use strict";

  var VALID_SEASONS = ["winter", "spring", "summer", "fall"];
  var SEASON_BY_MONTH = [
    "winter", "winter",
    "spring", "spring", "spring",
    "summer", "summer", "summer",
    "fall", "fall", "fall",
    "winter"
  ];
  var THEME_COLORS = {
    winter: "#152C38",
    spring: "#213A31",
    summer: "#1A404B",
    fall: "#352A23"
  };
  var PARTICLE_COUNTS = {
    winter: 22,
    spring: 12,
    summer: 14,
    fall: 14
  };

  var root = document.documentElement;
  var formatter = null;
  var preview = getPreviewSeason();
  var activeSeason = null;

  try {
    formatter = new Intl.DateTimeFormat("en-US-u-nu-latn", {
      timeZone: "America/Denver",
      month: "numeric"
    });
  } catch (error) {
    formatter = null;
  }

  function isValidSeason(value) {
    return VALID_SEASONS.indexOf(value) !== -1;
  }

  function getPreviewSeason() {
    try {
      var requested = new URLSearchParams(window.location.search).get("season");
      if (requested === null) return null;
      requested = requested.trim().toLowerCase();
      return isValidSeason(requested) ? requested : null;
    } catch (error) {
      return null;
    }
  }

  function seasonForMonth(month) {
    return SEASON_BY_MONTH[Number(month) - 1] || null;
  }

  function automaticSeason(now) {
    if (!formatter) return null;

    var date = now || new Date();
    var month = null;

    try {
      if (typeof formatter.formatToParts === "function") {
        var parts = formatter.formatToParts(date);
        for (var i = 0; i < parts.length; i += 1) {
          if (parts[i].type === "month") {
            month = Number(parts[i].value);
            break;
          }
        }
      } else {
        month = Number(formatter.format(date));
      }
    } catch (error) {
      return null;
    }

    return seasonForMonth(month);
  }

  function setThemeColor(season) {
    if (!season) return;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", THEME_COLORS[season]);
  }

  function markCurrentSeasonCard(season) {
    var cards = document.querySelectorAll("[data-season-card]");
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].getAttribute("data-season-card") === season) {
        cards[i].setAttribute("aria-current", "true");
      } else {
        cards[i].removeAttribute("aria-current");
      }
    }
  }

  function seededFraction(index, salt) {
    var value = Math.sin((index + 1) * (salt + 1) * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  function motionIsReduced() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function mountAtmosphere(season) {
    if (!document.body) return;

    var existing = document.querySelector('[data-seasonal-layer="true"]');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!season || motionIsReduced()) return;

    var host = document.querySelector(".hero, .phead") || document.body;
    var layer = document.createElement("div");
    var fragment = document.createDocumentFragment();
    var count = PARTICLE_COUNTS[season] || 0;

    layer.className = "seasonal-atmosphere seasonal-atmosphere--" + season;
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("data-seasonal-layer", "true");

    for (var i = 0; i < count; i += 1) {
      var particle = document.createElement("span");
      particle.className = "seasonal-particle";
      particle.style.setProperty("--season-x", Math.round(seededFraction(i, 1) * 100) + "%");
      particle.style.setProperty("--season-y", Math.round(12 + seededFraction(i, 2) * 76) + "%");
      particle.style.setProperty("--season-size", (3 + seededFraction(i, 3) * 7).toFixed(1) + "px");
      particle.style.setProperty("--season-duration", (8 + seededFraction(i, 4) * 11).toFixed(1) + "s");
      particle.style.setProperty("--season-delay", (-seededFraction(i, 5) * 16).toFixed(1) + "s");
      particle.style.setProperty("--season-drift", Math.round(-48 + seededFraction(i, 6) * 96) + "px");
      particle.style.setProperty("--season-drift-soft", Math.round(-22 + seededFraction(i, 8) * 44) + "px");
      particle.style.setProperty("--season-rotation", Math.round(140 + seededFraction(i, 7) * 620) + "deg");
      fragment.appendChild(particle);
    }

    layer.appendChild(fragment);
    host.insertBefore(layer, host.firstChild);
  }

  function updateDecorations(season) {
    if (document.readyState === "loading") return;
    markCurrentSeasonCard(season);
    if (!document.querySelector('[data-seasonal-layer="true"]') ||
        document.querySelector('[data-seasonal-layer="true"]').className.indexOf(season) === -1) {
      mountAtmosphere(season);
    }
  }

  function applySeason() {
    var season = preview || automaticSeason(new Date());

    if (!season) {
      activeSeason = null;
      root.removeAttribute("data-season");
      root.setAttribute("data-season-source", "fallback");
      return null;
    }

    var changed = activeSeason !== season;
    activeSeason = season;
    root.setAttribute("data-season", season);
    root.setAttribute("data-season-source", preview ? "preview" : "automatic");
    setThemeColor(season);

    if (changed) updateDecorations(season);
    return season;
  }

  applySeason();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      markCurrentSeasonCard(activeSeason);
      mountAtmosphere(activeSeason);
    }, { once: true });
  } else {
    markCurrentSeasonCard(activeSeason);
    mountAtmosphere(activeSeason);
  }

  if (!preview) {
    window.setInterval(applySeason, 60000);
    window.addEventListener("pageshow", applySeason);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) applySeason();
    });
  }

  window.NorthPineSeason = Object.freeze({
    seasonForMonth: seasonForMonth,
    automaticSeason: automaticSeason,
    refresh: applySeason,
    get current() {
      return root.getAttribute("data-season");
    },
    get source() {
      return root.getAttribute("data-season-source");
    }
  });
})(window, document);
