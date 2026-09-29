// Landing page interactions: mobile menu, scroll reveal, savings calculator, billing toggle.
(function () {
  "use strict";

  // Mobile menu
  var menuBtn = document.querySelector(".menu-btn");
  var mobileNav = document.getElementById("mobileNav");
  menuBtn.addEventListener("click", function () {
    var open = menuBtn.getAttribute("aria-expanded") === "true";
    menuBtn.setAttribute("aria-expanded", String(!open));
    menuBtn.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    mobileNav.hidden = open;
  });
  mobileNav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { mobileNav.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  });

  // Blur-fade reveal (skipped when reduced motion is on or IntersectionObserver is missing)
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reduce) {
    document.documentElement.classList.add("js-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  }

  // Household savings calculator
  var WASTE_RATE = 0.319, WASTE_RECOVERED = 0.5, STORE_SAVINGS = 0.08;
  var TAKEOUT_COST = 30, HOME_DINNER = 10, PLUS_PRICE = 4.99;
  var bill = document.getElementById("bill");
  var takeout = document.getElementById("takeout");
  function usd(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
  function calc() {
    var b = Number(bill.value), t = Number(takeout.value);
    var waste = b * WASTE_RATE * WASTE_RECOVERED;
    var store = (b - waste) * STORE_SAVINGS;
    var take = t * (2 / 3) * (TAKEOUT_COST - HOME_DINNER);
    var week = waste + store + take;
    document.getElementById("billOut").textContent = usd(b);
    document.getElementById("takeOut").textContent = t;
    document.getElementById("wasteOut").textContent = usd(waste) + "/wk";
    document.getElementById("storeOut").textContent = usd(store) + "/wk";
    document.getElementById("takeoutOut").textContent = usd(take) + "/wk";
    document.getElementById("monthly").textContent = usd(week * 52 / 12);
    document.getElementById("yearly").textContent = usd(week * 52);
    var days = week > 0 ? Math.max(1, Math.ceil(PLUS_PRICE / (week / 7))) : 0;
    document.getElementById("payback").textContent = days ? "Plus pays for itself in about " + days + " day" + (days === 1 ? "" : "s") + "." : "";
  }
  bill.addEventListener("input", calc);
  takeout.addEventListener("input", calc);
  calc();

  // Billing toggle
  var PRICES = {
    monthly: { plus: "$4.99", family: "$7.99", period: "/month", plusNote: "Billed monthly", familyNote: "Billed monthly" },
    annual: { plus: "$3.25", family: "$5.19", period: "/month", plusNote: "$38.99 billed yearly", familyNote: "$62.29 billed yearly" },
  };
  document.querySelectorAll("[data-billing]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var p = PRICES[btn.dataset.billing];
      document.querySelectorAll("[data-billing]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      document.querySelector('[data-price="plus"]').textContent = p.plus;
      document.querySelector('[data-price="family"]').textContent = p.family;
      document.querySelector('[data-note="plus"]').textContent = p.plusNote;
      document.querySelector('[data-note="family"]').textContent = p.familyNote;
      document.querySelectorAll("[data-period]").forEach(function (el) { el.textContent = p.period; });
    });
  });
})();
