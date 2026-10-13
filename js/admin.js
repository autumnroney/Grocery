/* Basketwise admin console.
   Everything here goes through the "admin" edge function, which re-checks the
   caller's role on every request. Employees get a read-only view plus
   "send sign-in link"; admins get every action. */
(function () {
  "use strict";

  var auth = BW.auth;
  var role = null;
  var users = [];
  var userFilter = { q: "", role: "all" };
  var autoTimer = null;
  var ROLE_LABEL = { admin: "Administrator", employee: "Employee", customer: "Customer" };
  var STORE_LABEL = { aldi: "Aldi", walmart: "Walmart", publix: "Publix", cheapest: "Cheapest each week" };
  var ACTION_LABEL = {
    set_role: "Changed role", set_password: "Set password", update_email: "Changed email",
    suspend: "Suspended", unsuspend: "Unsuspended", sign_out_everywhere: "Signed out everywhere",
    delete_user: "Deleted user", invite: "Invited user", send_sign_in_link: "Sent sign-in link",
  };

  // ---------- Helpers ----------

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso, withTime) {
    if (!iso) return "—";
    var d = new Date(iso);
    var opts = { month: "short", day: "numeric", year: "numeric" };
    if (withTime) { opts.hour = "numeric"; opts.minute = "2-digit"; }
    return d.toLocaleString(undefined, opts);
  }
  function ago(iso) {
    if (!iso) return "Never";
    var s = Math.round((Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 30) return Math.round(s / 86400) + " d ago";
    return fmtDate(iso);
  }
  function bytes(n) {
    if (n == null) return "—";
    var u = ["B", "KB", "MB", "GB"], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (Math.round(n * 10) / 10) + " " + u[i];
  }
  function isSuspended(u) { return u.banned_until && Date.parse(u.banned_until) > Date.now(); }
  function isAdmin() { return role === "admin"; }

  var toastTimer;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.toggle("error", !!isError);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  function call(action, body) { return auth.callAdmin(action, body); }

  // ---------- Access gate ----------

  function showGate(html) {
    $("gate").innerHTML = html;
    $("gate").hidden = false;
    ["overview", "users", "activity"].forEach(function (s) { $("panel-" + s).hidden = true; });
    document.querySelector(".admin-tabs").hidden = true;
  }

  if (auth.unavailable) {
    showGate('<h1 class="h3">Admin console unavailable</h1><p class="muted">Couldn\'t load the sign-in service. Try again in a moment.</p>');
    return;
  }

  auth.onChange(function (user) {
    if (!user) location.replace("login.html");
  });

  auth.onRole(function () {
    if (!auth.user || role) return;
    // Ask the server, not the page, whether this account may use the console.
    call("me").then(function (me) {
      role = me.role;
      if (role !== "admin" && role !== "employee") {
        showGate('<h1 class="h3">You don\'t have access to this page</h1><p class="muted">The admin console is for Basketwise administrators and employees. If you need access, ask an administrator to change your role.</p><a class="btn btn-primary" href="plan.html">Go to my planner</a>');
        return;
      }
      $("gate").hidden = true;
      document.querySelector(".admin-tabs").hidden = false;
      document.body.classList.toggle("is-employee", role === "employee");
      var hash = location.hash.replace("#", "");
      showSection(["overview", "users", "activity"].indexOf(hash) >= 0 ? hash : "overview");
      loadStatus();
    }, function (err) {
      showGate('<h1 class="h3">Couldn\'t open the admin console</h1><p class="muted">' + esc(err.message) + '</p><button type="button" class="btn btn-primary" onclick="location.reload()">Try again</button>');
    });
  });

  // ---------- Sections ----------

  var loaded = {};
  function showSection(name) {
    ["overview", "users", "activity"].forEach(function (s) {
      var on = s === name;
      $("panel-" + s).hidden = !on;
      var tab = $("tab-" + s);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    history.replaceState(null, "", "#" + name);
    if (name === "users" && !loaded.users) loadUsers();
    if (name === "activity" && !loaded.activity) loadAudit();
  }

  document.getElementById("adminTabs").addEventListener("click", function (e) {
    var t = e.target.closest("[data-section]");
    if (t) showSection(t.dataset.section);
  });
  document.getElementById("adminTabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var order = ["overview", "users", "activity"];
    var cur = order.indexOf(e.target.dataset.section);
    var next = order[(cur + (e.key === "ArrowRight" ? 1 : 2)) % 3];
    showSection(next);
    $("tab-" + next).focus();
  });

  // ---------- Overview ----------

  function healthCard(title, ok, main, rows) {
    return '<article class="card health ' + (ok ? "ok" : "down") + '">' +
      '<div class="health-top"><h3 class="h6">' + title + '</h3><span class="pill-status">' + (ok ? "● Online" : "● Problem") + "</span></div>" +
      '<p class="health-main">' + main + "</p>" +
      '<dl class="facts-list compact">' + rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>" +
    "</article>";
  }

  function kpi(label, value, note) {
    return '<div class="card kpi"><p class="kpi-label">' + label + '</p><p class="kpi-value num">' + value + "</p>" + (note ? '<p class="xsmall muted">' + note + "</p>" : "") + "</div>";
  }

  function loadStatus() {
    var btn = $("refreshStatus");
    btn.disabled = true;
    btn.textContent = "Checking…";
    var started = performance.now();
    call("status").then(function (s) {
      var roundTrip = Math.round(performance.now() - started);
      renderStatus(s, roundTrip);
    }, function (err) {
      $("health").innerHTML = healthCard("Admin service", false, "Unreachable", [["Error", esc(err.message)]]);
      $("checkedAt").textContent = "Last check failed at " + new Date().toLocaleTimeString();
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Refresh";
    });
  }

  function renderStatus(s, roundTrip) {
    var db = s.database || {}, au = s.auth || {}, u = s.users || {}, roles = s.roles || {};
    $("checkedAt").textContent = "Last checked " + new Date(s.checked_at).toLocaleTimeString() + " · round trip " + roundTrip + " ms";
    $("health").innerHTML =
      healthCard("Database", db.ok, db.ok ? "Connected · " + db.latency_ms + " ms" : "Not responding", db.ok ? [
        ["Postgres", esc(db.postgres_version)],
        ["Connections", db.connections + " of " + db.max_connections],
        ["Size", bytes(db.database_size_bytes)],
        ["Up since", fmtDate(db.started_at, true)],
      ] : [["Error", esc(db.error)]]) +
      healthCard("Sign-in service", au.ok, au.ok ? "Responding · " + au.latency_ms + " ms" : "Not responding", au.ok ? [
        ["Version", esc(au.version || "—")],
        ["Active sessions", db.active_sessions != null ? db.active_sessions : "—"],
      ] : [["Error", esc(au.error)]]) +
      healthCard("Admin API", true, "Responding · " + roundTrip + " ms", [
        ["Region", esc((s.functions && s.functions.region) || "—")],
        ["Website", location.host],
      ]);

    var t = db.tables || {};
    $("kpis").innerHTML =
      kpi("Total users", u.total != null ? u.total : "—", (roles.admin || 0) + " admin · " + (roles.employee || 0) + " employee · " + (roles.customer || 0) + " customer") +
      kpi("New this week", u.new_7d != null ? u.new_7d : "—", "Signed up in the last 7 days") +
      kpi("Active this week", u.active_7d != null ? u.active_7d : "—", (u.active_30d != null ? u.active_30d : "—") + " in the last 30 days") +
      kpi("Profiles set up", t.profiles != null ? t.profiles : "—", u.total ? Math.round((t.profiles || 0) / u.total * 100) + "% of users" : "") +
      kpi("Saved weekly plans", t.plans != null ? t.plans : "—", (db.planned_meals || 0) + " meals planned") +
      kpi("Need attention", (u.suspended || 0) + (u.unconfirmed || 0), (u.suspended || 0) + " suspended · " + (u.unconfirmed || 0) + " unconfirmed");

    var pop = db.popular_recipes || [];
    var max = pop.length ? pop[0].count : 1;
    $("popular").innerHTML = pop.length ? pop.map(function (p) {
      var r = BW.RECIPES.find(function (x) { return x.id === p.recipe; });
      return '<li><span class="rank-name">' + (r ? r.emoji + " " + esc(r.name) : esc(p.recipe)) + '</span><span class="rank-bar"><i style="width:' + Math.round(p.count / max * 100) + '%"></i></span><span class="num">' + p.count + "</span></li>";
    }).join("") : '<li class="muted small">No saved plans yet.</li>';

    function prefList(obj, labels) {
      var keys = Object.keys(obj || {});
      if (!keys.length) return '<p class="small muted">No profiles yet.</p>';
      return '<ul class="pref-list">' + keys.sort(function (a, b) { return obj[b] - obj[a]; }).map(function (k) {
        return "<li><span>" + esc(labels[k] || k) + '</span><span class="num">' + obj[k] + "</span></li>";
      }).join("") + "</ul>";
    }
    $("prefs").innerHTML = '<h3 class="xsmall muted caps">Diets</h3>' + prefList(db.diets, BW.TAGS) +
      '<h3 class="xsmall muted caps">Preferred store</h3>' + prefList(db.stores, STORE_LABEL);

    $("dbFacts").innerHTML = [
      ["Server time", fmtDate(db.server_time, true)],
      ["Profiles", t.profiles], ["Saved plans", t.plans], ["Role records", t.user_roles], ["Activity log entries", t.admin_audit_log],
    ].map(function (r) { return "<div><dt>" + r[0] + "</dt><dd class=\"num\">" + (r[1] != null ? r[1] : "—") + "</dd></div>"; }).join("");
  }

  $("refreshStatus").addEventListener("click", loadStatus);
  $("autoRefresh").addEventListener("change", function (e) {
    clearInterval(autoTimer);
    if (e.target.checked) autoTimer = setInterval(function () { if (!document.hidden) loadStatus(); }, 60000);
  });

  // ---------- Users ----------

  function loadUsers() {
    loaded.users = true;
    $("userRows").innerHTML = '<tr><td colspan="7" class="muted">Loading users…</td></tr>';
    return call("users").then(function (list) {
      users = list;
      renderUsers();
    }, function (err) {
      loaded.users = false;
      $("userRows").innerHTML = '<tr><td colspan="7" class="err-text">Couldn\'t load users: ' + esc(err.message) + "</td></tr>";
    });
  }

  function filteredUsers() {
    var q = userFilter.q.toLowerCase();
    return users.filter(function (u) {
      if (userFilter.role === "suspended" ? !isSuspended(u) : userFilter.role !== "all" && u.role !== userFilter.role) return false;
      if (!q) return true;
      return (u.email || "").toLowerCase().indexOf(q) >= 0 || ((u.profile && u.profile.display_name) || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  function statusBadge(u) {
    if (isSuspended(u)) return '<span class="badge status-bad">Suspended</span>';
    if (!u.email_confirmed_at) return '<span class="badge badge-gold">Unconfirmed</span>';
    return '<span class="badge badge-green">Active</span>';
  }

  function renderUsers() {
    var list = filteredUsers();
    $("userCount").textContent = list.length === users.length ? users.length + " users" : list.length + " of " + users.length + " users";
    if (!list.length) {
      $("userRows").innerHTML = '<tr><td colspan="7" class="muted">No users match.</td></tr>';
      return;
    }
    $("userRows").innerHTML = list.map(function (u) {
      var name = u.profile && u.profile.display_name;
      return '<tr class="user-row" data-user="' + u.id + '" tabindex="0" aria-label="Open ' + esc(name || u.email) + '">' +
        '<th scope="row"><span class="u-cell"><span class="u-avatar" aria-hidden="true">' + esc((name || u.email || "?").charAt(0).toUpperCase()) + '</span><span><span class="u-name">' + esc(name || "No profile name") + '</span><span class="xsmall muted">' + esc(u.email) + (u.id === auth.user.id ? " (you)" : "") + "</span></span></span></th>" +
        '<td><span class="badge role-' + u.role + '">' + ROLE_LABEL[u.role] + "</span></td>" +
        "<td>" + fmtDate(u.created_at) + "</td>" +
        "<td>" + ago(u.last_sign_in_at) + "</td>" +
        "<td>" + (u.profile ? "✓ Set up" : '<span class="muted">Not yet</span>') + "</td>" +
        '<td class="num num-col">' + (u.plan ? u.plan.meals : 0) + "</td>" +
        "<td>" + statusBadge(u) + "</td>" +
      "</tr>";
    }).join("");
  }

  $("userSearch").addEventListener("input", function (e) { userFilter.q = e.target.value.trim(); renderUsers(); });
  $("roleFilter").addEventListener("click", function (e) {
    var b = e.target.closest("[data-role-filter]");
    if (!b) return;
    userFilter.role = b.dataset.roleFilter;
    document.querySelectorAll("[data-role-filter]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    renderUsers();
  });
  $("userRows").addEventListener("click", function (e) {
    var row = e.target.closest("[data-user]");
    if (row) openUser(row.dataset.user);
  });
  $("userRows").addEventListener("keydown", function (e) {
    var row = e.target.closest("[data-user]");
    if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openUser(row.dataset.user); }
  });

  $("exportCsv").addEventListener("click", function () {
    var head = ["email", "name", "role", "joined", "last_sign_in", "status", "household_size", "diet", "preferred_store", "zip_code", "meals_planned"];
    var rows = filteredUsers().map(function (u) {
      var p = u.profile || {};
      return [u.email, p.display_name || "", u.role, u.created_at, u.last_sign_in_at || "",
        isSuspended(u) ? "suspended" : u.email_confirmed_at ? "active" : "unconfirmed",
        p.household_size || "", (p.diet || []).join(" "), p.preferred_store || "", p.zip_code || "", u.plan ? u.plan.meals : 0];
    });
    var csv = [head].concat(rows).map(function (r) {
      return r.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
    }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "basketwise-users-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  // ---------- User detail ----------

  var dialog = $("userDialog");
  var current = null;

  function openUser(id) {
    current = users.find(function (u) { return u.id === id; });
    if (!current) return;
    renderUserDialog();
    dialog.showModal();
  }

  function renderUserDialog() {
    var u = current, p = u.profile, me = u.id === auth.user.id;
    var adminOnly = isAdmin() ? "" : " disabled";
    var lockNote = isAdmin() ? "" : '<p class="xsmall muted">Only administrators can change accounts.</p>';
    var methods = (u.providers || []).map(function (m) { return m === "email" ? "Email link or password" : m; }).join(", ") || "Email";
    $("udBody").innerHTML =
      '<div class="dlg-head"><span class="u-avatar lg" aria-hidden="true">' + esc(((p && p.display_name) || u.email || "?").charAt(0).toUpperCase()) + "</span>" +
        '<div><h2 id="udTitle" class="h4">' + esc((p && p.display_name) || u.email) + "</h2>" +
        '<p class="small muted">' + esc(u.email) + (me ? " · this is you" : "") + "</p></div>" +
        '<button type="button" class="icon-btn dlg-close" data-close aria-label="Close">✕</button></div>' +
      '<div class="ud-badges"><span class="badge role-' + u.role + '">' + ROLE_LABEL[u.role] + "</span>" + statusBadge(u) + "</div>" +

      '<div class="ud-cols"><section><h3 class="h6">Account</h3><dl class="facts-list compact">' +
        "<div><dt>Joined</dt><dd>" + fmtDate(u.created_at, true) + "</dd></div>" +
        "<div><dt>Last sign-in</dt><dd>" + (u.last_sign_in_at ? fmtDate(u.last_sign_in_at, true) : "Never") + "</dd></div>" +
        "<div><dt>Email confirmed</dt><dd>" + (u.email_confirmed_at ? fmtDate(u.email_confirmed_at) : "No") + "</dd></div>" +
        "<div><dt>Sign-in method</dt><dd>" + esc(methods) + "</dd></div>" +
        "<div><dt>Saved plan</dt><dd>" + (u.plan ? u.plan.meals + " meals · updated " + ago(u.plan.updated_at) : "None") + "</dd></div>" +
        '<div><dt>User ID</dt><dd class="mono">' + esc(u.id) + "</dd></div>" +
      "</dl></section>" +
      "<section><h3 class=\"h6\">Profile</h3>" + (p ? '<dl class="facts-list compact">' +
        "<div><dt>Household</dt><dd>" + p.household_size + " people</dd></div>" +
        "<div><dt>Carb goal</dt><dd>" + esc((BW.CARB_GOALS[p.carb_goal] || {}).label || p.carb_goal) + "</dd></div>" +
        "<div><dt>Diet</dt><dd>" + (p.diet && p.diet.length ? p.diet.map(function (d) { return esc(BW.TAGS[d] || d); }).join(", ") : "No preference") + "</dd></div>" +
        "<div><dt>Store</dt><dd>" + esc(STORE_LABEL[p.preferred_store || "cheapest"]) + "</dd></div>" +
        "<div><dt>ZIP</dt><dd>" + esc(p.zip_code || "—") + "</dd></div>" +
      "</dl>" : '<p class="small muted">This user hasn\'t set up a profile yet.</p>') + "</section></div>" +

      '<section class="ud-actions"><h3 class="h6">Actions</h3>' + lockNote +
        '<div class="action-row"><div><strong>Role</strong><p class="xsmall muted">Admins can do everything here. Employees can view and send sign-in links.</p></div>' +
          '<div class="action-ctl"><label class="sr-only" for="udRole">Role</label><select id="udRole" class="select select-sm"' + adminOnly + ">" +
            ["customer", "employee", "admin"].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + ROLE_LABEL[r] + "</option>"; }).join("") +
          '</select><button type="button" class="btn btn-sm btn-primary" data-act="set_role"' + adminOnly + ">Save role</button></div></div>" +

        '<div class="action-row"><div><strong>Send a sign-in link</strong><p class="xsmall muted">Emails them a one-time link. The quickest fix for "I can\'t get in."</p></div>' +
          '<div class="action-ctl"><button type="button" class="btn btn-sm btn-ghost" data-act="send_link"' + (isSuspended(u) ? " disabled" : "") + ">Send link</button></div></div>" +

        '<div class="action-row"><div><strong>Set a password</strong><p class="xsmall muted">They can then use "Sign in with a password" on the sign-in page. 8+ characters.</p></div>' +
          '<div class="action-ctl"><label class="sr-only" for="udPassword">New password</label><input id="udPassword" class="text-input" type="text" autocomplete="off" spellcheck="false" placeholder="New password"' + adminOnly + ">" +
          '<button type="button" class="btn btn-sm btn-ghost" data-act="gen_password"' + adminOnly + '>Generate</button><button type="button" class="btn btn-sm btn-primary" data-act="set_password"' + adminOnly + ">Set password</button></div></div>" +

        '<div class="action-row"><div><strong>Change email</strong><p class="xsmall muted">Updates their sign-in email right away.</p></div>' +
          '<div class="action-ctl"><label class="sr-only" for="udEmail">New email</label><input id="udEmail" class="text-input" type="email" autocomplete="off" value="' + esc(u.email) + '"' + adminOnly + ">" +
          '<button type="button" class="btn btn-sm btn-primary" data-act="update_email"' + adminOnly + ">Save email</button></div></div>" +

        '<div class="action-row"><div><strong>Sign out everywhere</strong><p class="xsmall muted">Ends their sessions on every device. Useful for a lost phone.</p></div>' +
          '<div class="action-ctl"><button type="button" class="btn btn-sm btn-ghost" data-act="revoke_sessions"' + adminOnly + ">Sign out everywhere</button></div></div>" +

        '<div class="action-row"><div><strong>' + (isSuspended(u) ? "Unsuspend account" : "Suspend account") + '</strong><p class="xsmall muted">' + (isSuspended(u) ? "Let them sign in again." : "Blocks sign-in and signs them out. Their data is kept.") + "</p></div>" +
          '<div class="action-ctl"><button type="button" class="btn btn-sm ' + (isSuspended(u) ? "btn-primary" : "btn-warn") + '" data-act="' + (isSuspended(u) ? "unsuspend" : "suspend") + '"' + (me && !isSuspended(u) ? " disabled title=\"You can't suspend yourself\"" : adminOnly) + ">" + (isSuspended(u) ? "Unsuspend" : "Suspend") + "</button></div></div>" +

        '<div class="action-row danger"><div><strong>Delete account</strong><p class="xsmall muted">Permanently removes the account, profile and saved plan. This can\'t be undone.</p></div>' +
          '<div class="action-ctl"><label class="sr-only" for="udConfirm">Type their email to confirm</label><input id="udConfirm" class="text-input" type="text" autocomplete="off" placeholder="Type their email to confirm"' + (me ? " disabled" : adminOnly) + ">" +
          '<button type="button" class="btn btn-sm btn-danger" data-act="delete_user"' + (me ? " disabled" : adminOnly) + ">Delete</button></div></div>" +
      "</section>" +
      '<p class="form-error" id="udError" role="alert"></p>';
  }

  function generatePassword() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    var out = "", buf = new Uint32Array(14);
    crypto.getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
    return out.slice(0, 4) + "-" + out.slice(4, 9) + "-" + out.slice(9);
  }

  var CONFIRM = {
    set_role: function (u) { return "Change " + u.email + " to " + ROLE_LABEL[$("udRole").value] + "?"; },
    revoke_sessions: function (u) { return "Sign " + u.email + " out of every device?"; },
    suspend: function (u) { return "Suspend " + u.email + "? They won't be able to sign in until you unsuspend them."; },
    set_password: function (u) { return "Set a new password for " + u.email + "? Share it with them privately."; },
  };

  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest("[data-close]")) { dialog.close(); return; }
    var btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    var act = btn.dataset.act, u = current;
    $("udError").textContent = "";
    if (act === "gen_password") { $("udPassword").value = generatePassword(); $("udPassword").select(); return; }

    var body = { user_id: u.id };
    if (act === "set_role") body.role = $("udRole").value;
    if (act === "set_password") {
      body.password = $("udPassword").value;
      if (body.password.length < 8) { $("udError").textContent = "Passwords need at least 8 characters."; return; }
    }
    if (act === "update_email") {
      body.email = $("udEmail").value.trim();
      if (body.email === u.email) return;
    }
    if (act === "delete_user") {
      body.confirm_email = $("udConfirm").value.trim();
      if (body.confirm_email !== u.email) { $("udError").textContent = "Type " + u.email + " exactly to confirm."; return; }
    }
    if (CONFIRM[act] && !confirm(CONFIRM[act](u))) return;

    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Working…";
    call(act, body).then(function (res) {
      var msg = {
        set_role: "Role updated.", send_link: "Sign-in link sent to " + u.email + ".",
        set_password: "Password set. Share it with them privately.", update_email: "Email updated.",
        revoke_sessions: "Signed out of " + (res && res.sessions_removed != null ? res.sessions_removed : "all") + " session(s).",
        suspend: "Account suspended.", unsuspend: "Account unsuspended.", delete_user: "Account deleted.",
      }[act];
      toast(msg);
      loaded.activity = false;
      if (act === "delete_user") {
        dialog.close();
        users = users.filter(function (x) { return x.id !== u.id; });
        renderUsers();
        return;
      }
      if (act === "set_password") $("udPassword").value = "";
      return call("users").then(function (list) {
        users = list;
        renderUsers();
        current = users.find(function (x) { return x.id === u.id; }) || current;
        if (dialog.open) renderUserDialog();
      });
    }, function (err) {
      btn.disabled = false;
      btn.textContent = label;
      $("udError").textContent = err.message;
    });
  });

  // ---------- Invite ----------

  var inviteDialog = $("inviteDialog");
  $("inviteBtn").addEventListener("click", function () {
    $("inviteForm").reset();
    $("inviteError").textContent = "";
    inviteDialog.showModal();
    $("inviteEmail").focus();
  });
  inviteDialog.addEventListener("click", function (e) {
    if (e.target === inviteDialog || e.target.closest("[data-close]")) inviteDialog.close();
  });
  $("inviteForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("inviteEmail").value.trim(), r = $("inviteRole").value, btn = $("inviteSubmit");
    if (!$("inviteEmail").checkValidity() || !email) { $("inviteError").textContent = "Enter a valid email address."; return; }
    btn.disabled = true;
    btn.textContent = "Sending…";
    call("invite", { email: email, role: r }).then(function () {
      inviteDialog.close();
      toast("Invite sent to " + email + ".");
      loaded.activity = false;
      loadUsers();
    }, function (err) {
      $("inviteError").textContent = err.message;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Send invite";
    });
  });

  // ---------- Activity log ----------

  function loadAudit() {
    loaded.activity = true;
    $("auditRows").innerHTML = '<tr><td colspan="5" class="muted">Loading…</td></tr>';
    call("audit").then(function (rows) {
      if (!rows.length) { $("auditRows").innerHTML = '<tr><td colspan="5" class="muted">No admin actions yet.</td></tr>'; return; }
      $("auditRows").innerHTML = rows.map(function (r) {
        var d = r.details || {};
        var detail = r.action === "set_role" ? ROLE_LABEL[d.from] + " → " + ROLE_LABEL[d.to]
          : r.action === "update_email" ? esc(d.from) + " → " + esc(d.to)
          : r.action === "invite" ? "As " + ROLE_LABEL[d.role]
          : r.action === "sign_out_everywhere" ? d.sessions_removed + " session(s)" : "";
        return "<tr><td>" + fmtDate(r.created_at, true) + "</td><td>" + esc(r.actor_email) + "</td><td>" + esc(ACTION_LABEL[r.action] || r.action) +
          "</td><td>" + esc(r.target_email || "—") + "</td><td>" + detail + "</td></tr>";
      }).join("");
    }, function (err) {
      loaded.activity = false;
      $("auditRows").innerHTML = '<tr><td colspan="5" class="err-text">Couldn\'t load the activity log: ' + esc(err.message) + "</td></tr>";
    });
  }
  $("refreshAudit").addEventListener("click", loadAudit);
})();
