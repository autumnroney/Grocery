/*
  Basketwise email login (Supabase magic links).

  Exposes BW.auth:
    user           the signed-in user, or null
    ready          a promise that resolves once the session has been checked
    onChange(fn)   calls fn(user) for the initial session and every sign-in/out
    signIn(email)  emails a magic link that signs the user in on plan.html
    signOut()      signs out and clears the plan saved on this device
    client         the Supabase client, for reading and writing data

  Also renders the account button into any element with [data-account].
*/
(function () {
  "use strict";

  var listeners = [];
  var auth = { user: null, client: null, onChange: onChange, signIn: signIn, signOut: signOut };
  window.BW = window.BW || {};
  BW.auth = auth;

  if (!window.supabase || !BW.SUPABASE_URL) {
    auth.ready = Promise.resolve(null);
    auth.unavailable = true;
    document.addEventListener("DOMContentLoaded", renderAccount);
    return;
  }

  // An expired or reused magic link lands on the planner with an error in the
  // URL; send the user to the sign-in page, which explains it.
  if (/error_description=/.test(location.hash) && !/login/.test(location.pathname)) {
    location.replace("login.html" + location.hash);
    return;
  }

  auth.client = window.supabase.createClient(BW.SUPABASE_URL, BW.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  var resolveReady, isReady = false;
  auth.ready = new Promise(function (r) { resolveReady = r; });

  // Supabase calls this with INITIAL_SESSION on load (including after a magic
  // link lands on the page), then on every sign-in, sign-out and token refresh.
  auth.client.auth.onAuthStateChange(function (event, session) {
    var user = session ? session.user : null;
    var changed = (auth.user && auth.user.id) !== (user && user.id);
    auth.user = user;
    if (event === "INITIAL_SESSION") { isReady = true; resolveReady(user); }
    if (changed || event === "INITIAL_SESSION") {
      // Run listeners outside the auth callback so they can call Supabase safely.
      setTimeout(function () {
        renderAccount();
        listeners.forEach(function (fn) { fn(user, event); });
      }, 0);
    }
  });

  // Listeners hear about the initial session and every later sign-in/out.
  function onChange(fn) {
    listeners.push(fn);
    if (isReady) setTimeout(function () { fn(auth.user, "INITIAL_SESSION"); }, 0);
  }

  function redirectUrl() {
    return location.origin + "/plan.html";
  }

  function signIn(email) {
    return auth.client.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
    });
  }

  function signOut() {
    return auth.client.auth.signOut().then(function () {
      // Don't leave this person's plan behind on a shared device.
      try { localStorage.removeItem("bw-planner-v1"); } catch (e) { /* ignore */ }
    });
  }

  // ---------- Header account button ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderAccount() {
    var slots = document.querySelectorAll("[data-account]");
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (auth.unavailable) { slot.innerHTML = ""; continue; }
      if (!auth.user) {
        slot.innerHTML = '<a class="btn btn-ghost btn-sm account-signin" href="login.html">Sign in</a>';
        continue;
      }
      var email = auth.user.email || "your account";
      slot.innerHTML =
        '<div class="account">' +
          '<button type="button" class="account-btn" aria-haspopup="true" aria-expanded="false" aria-label="Account menu for ' + esc(email) + '">' +
            esc(email.charAt(0).toUpperCase()) +
          "</button>" +
          '<div class="account-menu card" hidden>' +
            '<p class="xsmall muted">Signed in as</p>' +
            '<p class="account-email">' + esc(email) + "</p>" +
            (location.pathname.indexOf("plan") < 0 ? '<a class="btn btn-sm btn-primary" href="plan.html">Open my planner</a>' : "") +
            '<button type="button" class="btn btn-sm btn-ghost" data-signout>Sign out</button>' +
          "</div>" +
        "</div>";
    }
  }

  function closeMenus(except) {
    var menus = document.querySelectorAll(".account-menu");
    for (var i = 0; i < menus.length; i++) {
      if (menus[i] === except) continue;
      menus[i].hidden = true;
      var b = menus[i].parentNode.querySelector(".account-btn");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".account-btn");
    if (btn) {
      var menu = btn.parentNode.querySelector(".account-menu");
      closeMenus(menu);
      menu.hidden = !menu.hidden;
      btn.setAttribute("aria-expanded", String(!menu.hidden));
      return;
    }
    if (e.target.closest("[data-signout]")) {
      e.target.closest("[data-signout]").disabled = true;
      signOut().then(function () { location.href = "index.html"; });
      return;
    }
    if (!e.target.closest(".account-menu")) closeMenus(null);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenus(null);
  });
  document.addEventListener("DOMContentLoaded", renderAccount);
})();
