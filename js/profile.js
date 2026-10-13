// Profile page: create (first sign-in) or edit the signed-in user's profile.
(function () {
  "use strict";

  var auth = BW.auth;
  var params = new URLSearchParams(location.search);
  var welcome = params.get("welcome") === "1";
  var form = document.getElementById("profileForm");
  var nameInput = document.getElementById("displayName");
  var zipInput = document.getElementById("zip");
  var household = 4;

  // Diet options match the planner's recipe filters (BW.TAGS) and the
  // database check constraint on profiles.diet.
  var DIETS = [
    ["vegetarian", "Vegetarian", "Only meat-free recipes"],
    ["gluten-free", "Gluten-free", "Only gluten-free recipes"],
    ["high-protein", "High protein", "25 g+ per serving"],
    ["high-fiber", "High fiber", "8 g+ per serving"],
    ["lower-carb", "Lower carb", "30 g or less per serving"],
  ];

  if (auth.unavailable) {
    document.getElementById("loading").textContent = "Profiles aren't available right now. Please try again later.";
    return;
  }

  // Build the choice controls.
  document.getElementById("carbGoal").innerHTML = Object.keys(BW.CARB_GOALS).map(function (k) {
    return '<option value="' + k + '">' + BW.CARB_GOALS[k].label + "</option>";
  }).join("");
  document.getElementById("diet").innerHTML = DIETS.map(function (d) {
    return '<label class="choice"><input type="checkbox" name="diet" value="' + d[0] + '"><span><strong>' + d[1] + "</strong><small>" + d[2] + "</small></span></label>";
  }).join("");
  document.getElementById("stores").innerHTML = '<label class="choice"><input type="radio" name="store" value="" checked><span><strong>Cheapest each week</strong><small>We pick for you</small></span></label>' +
    BW.STORES.map(function (s) {
      return '<label class="choice"><input type="radio" name="store" value="' + s.id + '"><span><strong>' + s.name + "</strong><small>Price my list here</small></span></label>";
    }).join("");

  function setHousehold(n) {
    household = Math.max(1, Math.min(12, n));
    document.getElementById("household").textContent = household;
  }
  function updateAvatar() {
    var v = nameInput.value.trim();
    document.getElementById("avatar").textContent = v ? v.charAt(0).toUpperCase() : "?";
  }

  function fill(profile) {
    nameInput.value = profile ? profile.display_name : "";
    setHousehold(profile ? profile.household_size : 4);
    document.getElementById("carbGoal").value = profile ? profile.carb_goal : "standard";
    var diet = profile ? profile.diet : [];
    form.querySelectorAll('input[name="diet"]').forEach(function (cb) { cb.checked = diet.indexOf(cb.value) >= 0; });
    var store = (profile && profile.preferred_store) || "";
    form.querySelectorAll('input[name="store"]').forEach(function (r) { r.checked = r.value === store; });
    zipInput.value = (profile && profile.zip_code) || "";
    updateAvatar();
  }

  function showForm(profile) {
    var isNew = !profile;
    document.getElementById("eyebrow").textContent = isNew ? "Welcome to Basketwise" : "Your profile";
    document.getElementById("title").textContent = isNew ? "Let's set up your profile" : "Your profile";
    document.getElementById("intro").textContent = isNew
      ? "A few quick details so your planner fits your family. You can change these anytime."
      : "These settings shape your planner: portions, carb targets, recipe filters and where we price your list.";
    document.getElementById("saveBtn").textContent = isNew ? "Save and start planning" : "Save profile";
    var skip = document.getElementById("skipLink");
    skip.textContent = isNew ? "Skip for now" : "Back to planner";
    document.getElementById("email").textContent = auth.user.email;
    fill(profile);
    document.getElementById("loading").hidden = true;
    form.hidden = false;
    if (isNew) nameInput.focus();
  }

  var shown = false;
  auth.onChange(function (user) {
    if (!user) { location.replace("login.html"); return; }
  });
  auth.onProfile(function (profile) {
    if (!auth.user) return; // signed out: onChange above redirects to sign-in
    if (shown) return; // don't overwrite edits in progress after our own save
    shown = true;
    showForm(profile);
  });

  // Interactions
  form.addEventListener("click", function (e) {
    var step = e.target.closest("[data-step]");
    if (step) setHousehold(household + Number(step.dataset.step));
  });
  nameInput.addEventListener("input", function () {
    updateAvatar();
    document.getElementById("nameError").textContent = "";
  });
  zipInput.addEventListener("input", function () {
    zipInput.value = zipInput.value.replace(/\D/g, "").slice(0, 5);
    document.getElementById("zipError").textContent = "";
  });
  document.getElementById("skipLink").addEventListener("click", function () {
    if (auth.profile === null) auth.skipProfile();
  });

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var zip = zipInput.value.trim();
    var ok = true;
    if (!name) {
      document.getElementById("nameError").textContent = "Please tell us what to call you.";
      ok = false;
    }
    if (zip && !/^\d{5}$/.test(zip)) {
      document.getElementById("zipError").textContent = "ZIP code should be 5 digits.";
      ok = false;
    }
    if (!ok) { (name ? zipInput : nameInput).focus(); return; }

    var wasNew = auth.profile === null;
    var btn = document.getElementById("saveBtn");
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving…";
    document.getElementById("saveError").textContent = "";

    auth.saveProfile({
      display_name: name,
      household_size: household,
      carb_goal: document.getElementById("carbGoal").value,
      diet: Array.prototype.map.call(form.querySelectorAll('input[name="diet"]:checked'), function (cb) { return cb.value; }),
      preferred_store: form.querySelector('input[name="store"]:checked').value || null,
      zip_code: zip || null,
    }).then(function () {
      if (wasNew || welcome) { location.href = "plan.html"; return; }
      btn.disabled = false;
      btn.textContent = label;
      toast("Profile saved. Your planner will use these settings.");
    }, function (err) {
      btn.disabled = false;
      btn.textContent = label;
      document.getElementById("saveError").textContent = "Couldn't save your profile" + (err && err.message ? ": " + err.message : "") + ". Please try again.";
    });
  });
})();
