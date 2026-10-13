/*
  Basketwise email login (Supabase magic links).

  Exposes BW.auth:
    user           the signed-in user, or null
    ready          a promise that resolves once the session has been checked
    onChange(fn)   calls fn(user) for the initial session and every sign-in/out
    signIn(email)  emails a magic link that signs the user in on plan.html
    signOut()      signs out and clears the plan saved on this device
    client         the Supabase client, for reading and writing data

  Profiles (public.profiles, one row per user):
    profile            the signed-in user's profile, null if they haven't made
                       one yet, undefined while it's loading
    onProfile(fn)      calls fn(profile) once it loads and after every save
    saveProfile(obj)   creates or updates the profile; resolves to the saved row

  Roles (public.user_roles: admin, employee or customer):
    role               the signed-in user's role; "customer" until loaded
    onRole(fn)         calls fn(role) once it loads
    callAdmin(action, body)  calls the admin edge function; resolves to its
                       data or rejects with a readable Error

  Signed-in users without a profile who land on the planner (e.g. from their
  first magic link) are sent to profile.html to set one up.

  Also renders the account button into any element with [data-account].
*/
(function () {
  "use strict";

  var listeners = [], profileListeners = [], roleListeners = [];
  var auth = { user: null, client: null, profile: undefined, role: "customer", roleLoaded: false,
    onChange: onChange, signIn: signIn, signInWithPassword: signInWithPassword, signOut: signOut,
    onProfile: onProfile, saveProfile: saveProfile, onRole: onRole, callAdmin: callAdmin };
  var SKIP_KEY = "bw-profile-skipped";
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
        auth.profile = user ? undefined : null;
        auth.role = "customer";
        auth.roleLoaded = !user;
        renderAccount();
        listeners.forEach(function (fn) { fn(user, event); });
        if (user) { loadProfile(user); loadRole(user); }
        else roleListeners.forEach(function (fn) { fn("customer"); });
      }, 0);
    }
  });

  // Listeners hear about the initial session and every later sign-in/out.
  function onChange(fn) {
    listeners.push(fn);
    if (isReady) setTimeout(function () { fn(auth.user, "INITIAL_SESSION"); }, 0);
  }

  // ---------- Profiles ----------

  function setProfile(profile) {
    if (profile && !Array.isArray(profile.diet)) profile.diet = [];
    auth.profile = profile;
    renderAccount();
    profileListeners.forEach(function (fn) { fn(profile); });
  }

  function loadProfile(user) {
    auth.client.from("profiles").select("*").eq("id", user.id).maybeSingle().then(function (res) {
      if (auth.user !== user) return; // signed out or switched while loading
      if (res.error) { setProfile(null); return; }
      setProfile(res.data);
      if (!res.data && needsOnboarding()) {
        location.replace("profile.html?welcome=1");
      }
    });
  }

  // Send new users to set up a profile once per browser session, only from
  // the planner (where magic links land), so it never interrupts other pages.
  function needsOnboarding() {
    if (!/plan/.test(location.pathname)) return false;
    try { return !sessionStorage.getItem(SKIP_KEY); } catch (e) { return false; }
  }

  function onProfile(fn) {
    profileListeners.push(fn);
    if (auth.profile !== undefined) setTimeout(function () { fn(auth.profile); }, 0);
  }

  function saveProfile(fields) {
    if (!auth.user) return Promise.reject(new Error("Not signed in"));
    var row = { id: auth.user.id };
    Object.keys(fields).forEach(function (k) { row[k] = fields[k]; });
    return auth.client.from("profiles").upsert(row).select().single().then(function (res) {
      if (res.error) throw res.error;
      setProfile(res.data);
      return res.data;
    });
  }

  auth.skipProfile = function () {
    try { sessionStorage.setItem(SKIP_KEY, "1"); } catch (e) { /* ignore */ }
  };

  // ---------- Roles ----------
  // The role only shapes what the page shows. The admin edge function checks
  // the role again on every request, so hiding or showing links is not what
  // keeps the admin tools safe.

  function loadRole(user) {
    auth.client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle().then(function (res) {
      if (auth.user !== user) return;
      auth.role = (res.data && res.data.role) || "customer";
      auth.roleLoaded = true;
      renderAccount();
      roleListeners.forEach(function (fn) { fn(auth.role); });
    });
  }

  function onRole(fn) {
    roleListeners.push(fn);
    if (auth.roleLoaded) setTimeout(function () { fn(auth.role); }, 0);
  }

  function callAdmin(action, body) {
    var payload = { action: action };
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    return auth.client.functions.invoke("admin", { body: payload }).then(function (res) {
      if (!res.error) return res.data.data;
      var ctx = res.error.context;
      if (ctx && typeof ctx.json === "function") {
        return ctx.json().then(function (j) { throw new Error((j && j.error) || res.error.message); },
          function (e) { if (e instanceof Error && e.message) throw e; throw new Error(res.error.message); });
      }
      throw new Error(res.error.message || "Couldn't reach the admin service.");
    });
  }

  function signInWithPassword(email, password) {
    return auth.client.auth.signInWithPassword({ email: email, password: password });
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
      try { localStorage.removeItem("bw-planner-v1"); sessionStorage.removeItem(SKIP_KEY); } catch (e) { /* ignore */ }
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
      var name = auth.profile && auth.profile.display_name;
      var wasOpen = slot.querySelector(".account-menu:not([hidden])");
      slot.innerHTML =
        '<div class="account">' +
          '<button type="button" class="account-btn" aria-haspopup="true" aria-expanded="' + !!wasOpen + '" aria-label="Account menu for ' + esc(name || email) + '">' +
            esc((name || email).charAt(0).toUpperCase()) +
          "</button>" +
          '<div class="account-menu card"' + (wasOpen ? "" : " hidden") + ">" +
            (name ? '<p class="account-name">' + esc(name) + "</p>" : '<p class="xsmall muted">Signed in as</p>') +
            (auth.role !== "customer" ? '<p><span class="badge role-' + auth.role + '">' + (auth.role === "admin" ? "Administrator" : "Employee") + "</span></p>" : "") +
            '<p class="account-email' + (name ? " xsmall muted" : "") + '">' + esc(email) + "</p>" +
            (location.pathname.indexOf("plan") < 0 ? '<a class="btn btn-sm btn-primary" href="plan.html">Open my planner</a>' : "") +
            (location.pathname.indexOf("profile") < 0
              ? '<a class="btn btn-sm btn-ghost" href="profile.html">' + (auth.profile === null ? "Set up your profile" : "Your profile") + "</a>" : "") +
            (auth.role !== "customer" && location.pathname.indexOf("admin") < 0
              ? '<a class="btn btn-sm btn-ghost" href="admin.html">Admin console</a>' : "") +
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
