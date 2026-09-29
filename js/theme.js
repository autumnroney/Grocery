// Light/dark theme: follows the system on first visit, then remembers the
// user's choice. Loaded in <head> so the page never flashes the wrong theme.
(function () {
  var KEY = "bw-theme";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function effective() {
    var s = stored();
    if (s === "light" || s === "dark") return s;
    return media && media.matches ? "dark" : "light";
  }
  function apply() {
    var s = stored();
    if (s === "light" || s === "dark") root.setAttribute("data-theme", s);
    else root.removeAttribute("data-theme");
    var eff = effective();
    root.setAttribute("data-theme-active", eff);
    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-label", eff === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btns[i].setAttribute("aria-pressed", eff === "dark" ? "true" : "false");
    }
  }

  apply();
  if (media && media.addEventListener) media.addEventListener("change", apply);

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = effective() === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (err) { /* private mode */ }
    apply();
  });
  document.addEventListener("DOMContentLoaded", apply);
})();
