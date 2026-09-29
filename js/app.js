/* Basketwise weekly planner. Plain JS, no build step. */
(function () {
  "use strict";

  var ING = BW.INGREDIENTS;
  var RECIPES = BW.RECIPES;
  var NUT = BW.NUTRIENTS;
  var STORES = BW.STORES;
  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var MEALS = ["breakfast", "lunch", "dinner"];
  var MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
  var TABS = [
    { id: "plan", label: "Plan", icon: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>' },
    { id: "list", label: "List", icon: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>' },
    { id: "nutrition", label: "Nutrition", icon: '<path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.5-7 11-7 11Z"/>' },
    { id: "stores", label: "Stores", icon: '<path d="M3 9 5 4h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M10 20v-6h4v6"/>' },
  ];
  var STORAGE_KEY = "bw-planner-v1";
  var EPS = 1e-6;

  var byId = {};
  RECIPES.forEach(function (r) { byId[r.id] = r; });

  // ---------- Per-recipe derived data ----------

  function perServing(r) {
    if (r._ps) return r._ps;
    var tot = NUT.map(function () { return 0; });
    r.ing.forEach(function (pair) {
      var ing = ING[pair[0]];
      for (var i = 0; i < tot.length; i++) tot[i] += ing.nu[i] * pair[1];
    });
    var out = {};
    NUT.forEach(function (n, i) { out[n.key] = tot[i] / r.serves; });
    r._ps = out;
    return out;
  }

  // Share-of-package cost per serving at the cheapest store for that recipe.
  function costPerServing(r) {
    if (r._cps != null) return r._cps;
    var best = Infinity;
    STORES.forEach(function (s, si) {
      var c = 0;
      r.ing.forEach(function (pair) {
        var ing = ING[pair[0]];
        c += (pair[1] / ing.pkg) * ing.p[si];
      });
      best = Math.min(best, c);
    });
    r._cps = best / r.serves;
    return r._cps;
  }

  // Nutrition-based tags are computed so they always match the numbers shown.
  RECIPES.forEach(function (r) {
    var ps = perServing(r);
    var tags = r.tags.filter(function (t) { return t === "vegetarian" || t === "gluten-free"; });
    if (ps.pro >= 25) tags.push("high-protein");
    if (ps.fib >= 8) tags.push("high-fiber");
    if (ps.carb <= 30) tags.push("lower-carb");
    if (r.mins <= 30) tags.push("under-30");
    r.tags = tags;
  });

  // ---------- State ----------

  var state = load();

  function defaults() {
    return { household: 4, carbGoal: "standard", plan: [], have: [], need: [], cart: [], store: null, tab: "plan", seq: 1 };
  }
  function load() {
    var s = defaults();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        Object.keys(s).forEach(function (k) { if (saved[k] !== undefined) s[k] = saved[k]; });
        s.plan = (s.plan || []).filter(function (p) { return byId[p.recipe]; });
      }
    } catch (e) { /* storage unavailable: start fresh */ }
    if (!BW.CARB_GOALS[s.carbGoal]) s.carbGoal = "standard";
    return s;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var ui = { query: "", meal: "all", tags: [] };
  var animateList = true;

  function isHave(id) {
    if (state.have.indexOf(id) >= 0) return true;
    return !!ING[id].staple && state.need.indexOf(id) < 0;
  }
  function toggleHave(id) {
    var have = isHave(id);
    state.have = state.have.filter(function (x) { return x !== id; });
    state.need = state.need.filter(function (x) { return x !== id; });
    if (have) state.need.push(id); else state.have.push(id);
  }

  // ---------- Core calculations ----------

  // Combine every planned recipe into one list: quantity needed, packages to
  // buy, what's left over, and cost at each store.
  function buildList(plan) {
    var map = {};
    plan.forEach(function (p) {
      var r = byId[p.recipe];
      var f = state.household / r.serves;
      r.ing.forEach(function (pair) {
        var id = pair[0];
        var m = map[id] || (map[id] = { id: id, qty: 0, recipes: [] });
        m.qty += pair[1] * f;
        if (m.recipes.indexOf(r.id) < 0) m.recipes.push(r.id);
      });
    });
    var items = Object.keys(map).map(function (id) {
      var m = map[id], ing = ING[id];
      m.ing = ing;
      m.pkgs = Math.max(1, Math.ceil(m.qty / ing.pkg - EPS));
      m.left = m.pkgs * ing.pkg - m.qty;
      if (m.left < EPS) m.left = 0;
      m.cost = ing.p.map(function (price) { return price * m.pkgs; });
      m.have = isHave(id);
      return m;
    });
    var totals = STORES.map(function (_, si) {
      return items.reduce(function (sum, it) { return it.have ? sum : sum + it.cost[si]; }, 0);
    });
    return { items: items, totals: totals, map: map };
  }

  function bestStoreIndex(totals) {
    var bi = 0;
    totals.forEach(function (t, i) { if (t < totals[bi]) bi = i; });
    return bi;
  }

  // Perishable leftovers worth planning around (at least ~20% of a package).
  function wasteRisk(it) {
    return it.left > EPS && !it.have && it.ing.keep === "fresh" && it.left / it.ing.pkg >= 0.2;
  }
  // Leftovers that keep a few weeks in the fridge: worth a mention, not a warning.
  function keepsLater(it) {
    return it.left > EPS && !it.have && it.ing.keep === "fridge" && it.left / it.ing.pkg >= 0.2;
  }

  // Rank recipes not yet planned by how cheaply they fit into this week's
  // list: the extra cost to add them, minus the value of leftovers they use up.
  function suggestions(list, limit, mealFilter) {
    var bi = bestStoreIndex(list.totals);
    var planned = {};
    state.plan.forEach(function (p) { planned[p.recipe] = true; });
    var out = [];
    RECIPES.forEach(function (r) {
      if (planned[r.id]) return;
      if (mealFilter && r.meal !== mealFilter) return;
      var withR = buildList(state.plan.concat([{ recipe: r.id }]));
      var added = withR.totals[bi] - list.totals[bi];
      var reuses = [], saved = 0, shared = 0;
      r.ing.forEach(function (pair) {
        var cur = list.map[pair[0]];
        if (!cur || ING[pair[0]].staple) return;
        shared++;
        if (cur.left > EPS && ING[pair[0]].keep !== "pantry") {
          var used = Math.min(cur.left, pair[1] * state.household / r.serves);
          saved += (used / cur.ing.pkg) * cur.ing.p[bi];
          if (reuses.indexOf(pair[0]) < 0) reuses.push(pair[0]);
        }
      });
      var perServ = added / state.household;
      out.push({ r: r, added: added, perServ: perServ, reuses: reuses, shared: shared, score: saved * 1.5 + shared * 0.35 - perServ });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit);
  }

  // Weekly nutrition, per person.
  function weekNutrition() {
    var total = {}, byDay = DAYS.map(function () { return { meals: 0 }; });
    NUT.forEach(function (n) { total[n.key] = 0; byDay.forEach(function (d) { d[n.key] = 0; }); });
    state.plan.forEach(function (p) {
      var ps = perServing(byId[p.recipe]);
      byDay[p.day].meals++;
      NUT.forEach(function (n) { total[n.key] += ps[n.key]; byDay[p.day][n.key] += ps[n.key]; });
    });
    return { total: total, byDay: byDay, meals: state.plan.length };
  }

  // ---------- Formatting ----------

  var FRACTIONS = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
  function fmtNum(q) {
    var whole = Math.floor(q + EPS), frac = q - whole;
    if (frac < 0.07) return String(whole);
    if (frac > 0.93) return String(whole + 1);
    for (var i = 0; i < FRACTIONS.length; i++) {
      if (Math.abs(frac - FRACTIONS[i][0]) < 0.07) return (whole ? whole : "") + FRACTIONS[i][1];
    }
    return (Math.round(q * 10) / 10).toString();
  }
  function fmtQty(q, ing) {
    var s = fmtNum(q);
    var plural = Math.abs(q - 1) > 0.07 && q > 1;
    return s + " " + (plural ? ing.up : ing.u);
  }
  function money(v) { return "$" + v.toFixed(2); }
  function round(v) { return v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function listNames(ids) {
    var names = ids.map(function (id) { return ING[id].n.toLowerCase(); });
    if (names.length <= 1) return names.join("");
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }

  // ---------- Toast ----------

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // ---------- Plan actions ----------

  function addRecipe(recipeId, day) {
    var r = byId[recipeId];
    if (day == null) {
      for (var d = 0; d < 7; d++) {
        var taken = state.plan.some(function (p) { return p.day === d && p.meal === r.meal; });
        if (!taken) { day = d; break; }
      }
    }
    if (day == null) {
      toast("All 7 " + MEAL_LABEL[r.meal].toLowerCase() + "s are planned. Remove one first.");
      return false;
    }
    state.plan.push({ id: state.seq++, recipe: r.id, day: day, meal: r.meal });
    sortPlan();
    toast(r.name + " added to " + DAYS[day] + ".");
    return true;
  }
  function sortPlan() {
    state.plan.sort(function (a, b) { return a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal); });
  }
  function removeEntry(entryId) {
    state.plan = state.plan.filter(function (p) { return p.id !== entryId; });
  }

  function autoPlan() {
    state.plan = state.plan.filter(function (p) { return p.meal !== "dinner"; });
    var first = RECIPES.filter(function (r) { return r.meal === "dinner"; })
      .sort(function (a, b) { return costPerServing(a) - costPerServing(b); })[Math.floor(Math.random() * 4)];
    var days = [0, 1, 2, 3, 4];
    state.plan.push({ id: state.seq++, recipe: first.id, day: days[0], meal: "dinner" });
    for (var i = 1; i < days.length; i++) {
      var s = suggestions(buildList(state.plan), 3, "dinner");
      var pick = s[Math.floor(Math.random() * Math.min(2, s.length))];
      state.plan.push({ id: state.seq++, recipe: pick.r.id, day: days[i], meal: "dinner" });
    }
    sortPlan();
    toast("Planned 5 dinners that share ingredients. Swap any you don't like.");
  }

  // ---------- Rendering ----------

  function render() {
    save();
    var list = buildList(state.plan);
    renderSummary(list);
    renderTabs(list);
    if (state.tab === "plan") { renderRecipes(list); renderWeek(); renderSuggestions(list); }
    if (state.tab === "list") renderList(list);
    if (state.tab === "nutrition") renderNutrition();
    if (state.tab === "stores") renderStores(list);
  }

  function renderSummary(list) {
    document.getElementById("household").textContent = state.household;
    document.getElementById("statMeals").textContent = state.plan.length;
    var buy = list.items.filter(function (it) { return !it.have; }).length;
    document.getElementById("statItems").textContent = buy;
    if (state.plan.length) {
      var bi = bestStoreIndex(list.totals);
      document.getElementById("statStore").textContent = STORES[bi].name;
      document.getElementById("statTotal").textContent = money(list.totals[bi]);
    } else {
      document.getElementById("statStore").textContent = "—";
      document.getElementById("statTotal").textContent = "$0.00";
    }
  }

  function renderTabs(list) {
    var left = list.items.filter(function (it) { return !it.have && state.cart.indexOf(it.id) < 0; }).length;
    ["tablistTop", "tablistBottom"].forEach(function (holder, hi) {
      var el = document.getElementById(holder);
      el.innerHTML = TABS.map(function (t) {
        var sel = state.tab === t.id;
        var badge = "";
        if (t.id === "list") {
          var n = left;
          if (n) badge = '<span class="tab-count num" aria-label="' + n + ' items left">' + n + "</span>";
        }
        return '<button type="button" role="tab" id="' + (hi ? "tabb-" : "tab-") + t.id + '" aria-controls="panel-' + t.id + '" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" data-tab="' + t.id + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t.icon + "</svg>" +
          "<span>" + t.label + "</span>" + badge + "</button>";
      }).join("");
    });
    TABS.forEach(function (t) {
      document.getElementById("panel-" + t.id).hidden = state.tab !== t.id;
    });
  }

  function renderFilters() {
    var meals = [["all", "All meals"], ["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]];
    document.getElementById("mealFilters").innerHTML = meals.map(function (m) {
      return '<button type="button" class="chip" data-meal="' + m[0] + '" aria-pressed="' + (ui.meal === m[0]) + '">' + m[1] + "</button>";
    }).join("");
    document.getElementById("tagFilters").innerHTML = Object.keys(BW.TAGS).map(function (t) {
      return '<button type="button" class="chip" data-tag="' + t + '" aria-pressed="' + (ui.tags.indexOf(t) >= 0) + '">' + BW.TAGS[t] + "</button>";
    }).join("");
  }

  function recipeMatches(r) {
    if (ui.meal !== "all" && r.meal !== ui.meal) return false;
    for (var i = 0; i < ui.tags.length; i++) if (r.tags.indexOf(ui.tags[i]) < 0) return false;
    if (ui.query) {
      var q = ui.query.toLowerCase();
      var hay = r.name.toLowerCase() + " " + r.ing.map(function (p) { return ING[p[0]].n.toLowerCase(); }).join(" ");
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  function renderRecipes(list) {
    var countIn = {};
    state.plan.forEach(function (p) { countIn[p.recipe] = (countIn[p.recipe] || 0) + 1; });
    var shown = RECIPES.filter(recipeMatches);
    document.getElementById("resultCount").textContent = shown.length + " recipe" + (shown.length === 1 ? "" : "s");
    var grid = document.getElementById("recipeGrid");
    if (!shown.length) {
      grid.innerHTML = '<p class="empty">No recipes match those filters. Try removing one.</p>';
      return;
    }
    grid.innerHTML = shown.map(function (r) {
      var ps = perServing(r);
      var shared = state.plan.length ? r.ing.filter(function (p) { return list.map[p[0]] && !ING[p[0]].staple; }).length : 0;
      var inPlan = countIn[r.id];
      return '<article class="recipe card' + (inPlan ? " in-plan" : "") + '">' +
        '<button type="button" class="recipe-open" data-open="' + r.id + '" aria-label="View ' + esc(r.name) + ' recipe">' +
          '<span class="recipe-emoji" aria-hidden="true">' + r.emoji + "</span>" +
          '<span class="recipe-meta xsmall">' + MEAL_LABEL[r.meal] + " · " + r.mins + " min · ~" + money(costPerServing(r)) + "/serving</span>" +
          '<h3 class="recipe-name">' + esc(r.name) + "</h3>" +
        "</button>" +
        '<dl class="macro-row">' +
          '<div><dt>Carbs</dt><dd class="num">' + Math.round(ps.carb) + " g</dd></div>" +
          '<div><dt>Protein</dt><dd class="num">' + Math.round(ps.pro) + " g</dd></div>" +
          '<div><dt>Fiber</dt><dd class="num">' + Math.round(ps.fib) + " g</dd></div>" +
          '<div><dt>Calories</dt><dd class="num">' + Math.round(ps.kcal) + "</dd></div>" +
        "</dl>" +
        '<div class="recipe-tags">' +
          (shared ? '<span class="badge badge-green">♻ Shares ' + shared + " ingredient" + (shared === 1 ? "" : "s") + "</span>" : "") +
          r.tags.slice(0, 3).map(function (t) { return '<span class="badge">' + BW.TAGS[t] + "</span>"; }).join("") +
        "</div>" +
        '<div class="recipe-actions">' +
          '<button type="button" class="btn btn-sm btn-primary" data-add="' + r.id + '">' + (inPlan ? "Add again" : "Add to week") + "</button>" +
          '<button type="button" class="btn btn-sm btn-ghost" data-open="' + r.id + '">Details</button>' +
          (inPlan ? '<span class="xsmall in-plan-note">✓ In your week' + (inPlan > 1 ? " ×" + inPlan : "") + "</span>" : "") +
        "</div>" +
      "</article>";
    }).join("");
  }

  function renderWeek() {
    var el = document.getElementById("days");
    el.innerHTML = DAYS.map(function (d, di) {
      var entries = state.plan.filter(function (p) { return p.day === di; });
      return '<li class="day">' +
        '<h3 class="day-name">' + d + "</h3>" +
        (entries.length ? '<ul class="day-meals">' + entries.map(function (p) {
          var r = byId[p.recipe];
          return '<li class="day-meal">' +
            '<span class="meal-type xsmall">' + MEAL_LABEL[p.meal] + "</span>" +
            '<button type="button" class="linklike" data-open="' + r.id + '">' + r.emoji + " " + esc(r.name) + "</button>" +
            '<span class="day-meal-actions">' +
              '<label class="sr-only" for="mv' + p.id + '">Move ' + esc(r.name) + " to another day</label>" +
              '<select class="select select-sm" id="mv' + p.id + '" data-move="' + p.id + '">' +
                DAYS.map(function (dd, i) { return '<option value="' + i + '"' + (i === di ? " selected" : "") + ">" + dd.slice(0, 3) + "</option>"; }).join("") +
              "</select>" +
              '<button type="button" class="icon-btn icon-sm" data-remove="' + p.id + '" aria-label="Remove ' + esc(r.name) + " from " + d + '">✕</button>' +
            "</span>" +
          "</li>";
        }).join("") + "</ul>" : '<p class="day-empty xsmall">Nothing planned</p>') +
      "</li>";
    }).join("");
  }

  function renderSuggestions(list) {
    var intro = document.getElementById("suggestIntro");
    var ul = document.getElementById("suggestList");
    if (!state.plan.length) {
      intro.textContent = "Add a recipe and we'll suggest others that reuse its ingredients. Or start with one of these budget-friendly picks:";
      var cheap = RECIPES.filter(function (r) { return r.meal === "dinner"; })
        .sort(function (a, b) { return costPerServing(a) - costPerServing(b); }).slice(0, 4);
      ul.innerHTML = cheap.map(function (r) {
        return suggestItem(r, "About " + money(costPerServing(r)) + " per serving");
      }).join("");
      return;
    }
    intro.textContent = "These reuse ingredients already on your list, ranked by how little they add to the bill.";
    ul.innerHTML = suggestions(list, 5).map(function (s) {
      var why = s.reuses.length
        ? "Uses up your leftover " + listNames(s.reuses.slice(0, 3))
        : s.shared ? "Shares " + s.shared + " ingredient" + (s.shared === 1 ? "" : "s") + " with your list" : "New ingredients";
      var cost = s.added < 0.005 ? "adds $0.00, you already have everything" : "adds " + money(s.added) + " (" + money(s.perServ) + "/serving)";
      return suggestItem(s.r, why + " · " + cost);
    }).join("");
  }
  function suggestItem(r, note) {
    return '<li class="suggest">' +
      '<span class="suggest-emoji" aria-hidden="true">' + r.emoji + "</span>" +
      '<span class="suggest-text"><button type="button" class="linklike" data-open="' + r.id + '">' + esc(r.name) + '</button><span class="xsmall muted">' + MEAL_LABEL[r.meal] + " · " + note + "</span></span>" +
      '<button type="button" class="btn btn-sm btn-ghost" data-add="' + r.id + '" aria-label="Add ' + esc(r.name) + ' to week">Add</button>' +
    "</li>";
  }

  // ---------- List ----------

  function storeIdx(list) {
    var i = STORES.findIndex(function (s) { return s.id === state.store; });
    return i >= 0 ? i : bestStoreIndex(list.totals);
  }

  function renderList(list) {
    var sel = document.getElementById("listStore");
    var si = storeIdx(list);
    var bi = bestStoreIndex(list.totals);
    sel.innerHTML = STORES.map(function (s, i) {
      return '<option value="' + s.id + '"' + (i === si ? " selected" : "") + ">" + s.name + (i === bi && state.plan.length ? " (cheapest)" : "") + "</option>";
    }).join("");

    var groups = document.getElementById("listGroups");
    var left = document.getElementById("leftovers");
    if (!state.plan.length) {
      groups.innerHTML = emptyState("Your list is empty", "Pick a few recipes on the Plan tab and your grocery list builds itself.");
      left.innerHTML = "";
      document.getElementById("cartText").textContent = "";
      document.getElementById("cartBar").style.width = "0";
      document.getElementById("listSub").textContent = "Quantities are combined across recipes and grouped by aisle.";
      return;
    }

    var toBuy = list.items.filter(function (it) { return !it.have; });
    var inCart = toBuy.filter(function (it) { return state.cart.indexOf(it.id) >= 0; });
    var pct = toBuy.length ? Math.round(inCart.length / toBuy.length * 100) : 0;
    document.getElementById("cartBar").style.width = pct + "%";
    document.getElementById("cartText").textContent = inCart.length + " of " + toBuy.length + " items in your cart · " +
      money(list.totals[si]) + " at " + STORES[si].name;
    document.getElementById("listSub").textContent = state.plan.length + " meals for " + state.household +
      (state.household === 1 ? " person" : " people") + ". Quantities are combined across recipes and grouped by aisle.";

    // Leftovers: fresh items with a meaningful amount left over.
    var risks = list.items.filter(wasteRisk);
    var later = list.items.filter(keepsLater);
    var laterHtml = later.length ? '<p class="xsmall muted later">Also left over, keeps a few weeks: ' +
      later.map(function (it) { return esc(it.ing.n.toLowerCase()) + " (" + fmtQty(it.left, it.ing) + ")"; }).join(", ") + ".</p>" : "";
    if (risks.length) {
      left.innerHTML = '<div class="leftover-card card"><h2 class="h5">♻ Use it up</h2><ul>' + risks.map(function (it) {
        var fix = RECIPES.filter(function (r) {
          return state.plan.every(function (p) { return p.recipe !== r.id; }) && r.ing.some(function (p) { return p[0] === it.id; });
        }).sort(function (a, b) { return costPerServing(a) - costPerServing(b); })[0];
        return "<li><span><strong>" + esc(it.ing.n) + ":</strong> " + fmtQty(it.left, it.ing) + " left over that won't keep long.</span>" +
          (fix ? ' <span class="leftover-fix">Try <button type="button" class="linklike" data-open="' + fix.id + '">' + esc(fix.name) + '</button> <button type="button" class="btn btn-sm btn-ghost" data-add="' + fix.id + '">Add</button></span>' : "") +
          "</li>";
      }).join("") + "</ul>" + laterHtml + "</div>";
    } else {
      left.innerHTML = '<div class="leftover-card card ok"><p class="small"><strong>✓ Nothing fresh goes to waste.</strong> Every perishable on this list gets used across your meals.</p>' + laterHtml + "</div>";
    }

    var html = "";
    BW.AISLES.forEach(function (a) {
      var items = toBuy.filter(function (it) { return it.ing.a === a.id && state.cart.indexOf(it.id) < 0; })
        .sort(function (x, y) { return x.ing.n.localeCompare(y.ing.n); });
      if (!items.length) return;
      html += '<section class="aisle"><h2 class="aisle-name h6"><span aria-hidden="true">' + a.icon + "</span> " + a.label + ' <span class="muted xsmall num">' + items.length + '</span></h2><ul class="items">' +
        items.map(function (it) { return itemRow(it, si, false); }).join("") + "</ul></section>";
    });
    if (inCart.length) {
      html += '<section class="aisle cart"><h2 class="aisle-name h6">🛒 In cart <span class="muted xsmall num">' + inCart.length + '</span></h2><ul class="items">' +
        inCart.map(function (it) { return itemRow(it, si, true); }).join("") + "</ul></section>";
    }
    var have = list.items.filter(function (it) { return it.have; });
    if (have.length) {
      html += '<section class="aisle have"><h2 class="aisle-name h6">🏠 Already have <span class="muted xsmall num">' + have.length + '</span></h2>' +
        '<p class="xsmall muted">Pantry staples start here. Not sure you have enough? Tap "Need it" to add it to the list.</p><ul class="items">' +
        have.map(function (it) {
          return '<li class="item have-item"><span class="item-main"><span class="item-name">' + esc(it.ing.n) + '</span><span class="xsmall muted">You\'ll use ' + fmtQty(it.qty, it.ing) + "</span></span>" +
            '<button type="button" class="btn btn-sm btn-ghost" data-have="' + it.id + '">Need it</button></li>';
        }).join("") + "</ul></section>";
    }
    groups.innerHTML = html;
    groups.classList.toggle("animate", animateList);
    animateList = false;
  }

  function itemRow(it, si, checked) {
    var usedIn = it.recipes.map(function (id) { return byId[id].name; });
    var label = it.ing.n + ", buy " + buyText(it) + ", used in " + usedIn.join(" and ");
    var leftNote = it.left > EPS && it.left / it.ing.pkg >= 0.2
      ? '<span class="xsmall ' + (wasteRisk(it) ? "warn" : "muted") + '">' + fmtQty(it.left, it.ing) + " left over</span>" : "";
    return '<li class="item' + (checked ? " checked" : "") + '">' +
      '<label class="check">' +
        '<input type="checkbox" data-cart="' + it.id + '"' + (checked ? " checked" : "") + ' aria-label="' + esc(label) + '">' +
        '<span class="box" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span>' +
      "</label>" +
      '<span class="item-main">' +
        '<span class="item-name">' + esc(it.ing.n) + "</span>" +
        '<span class="xsmall muted">Buy ' + buyText(it) + " · you'll use " + fmtQty(it.qty, it.ing) + "</span>" +
        '<span class="used-in">' + it.recipes.map(function (id) { return '<span class="badge">' + byId[id].emoji + " " + esc(shortName(byId[id].name)) + "</span>"; }).join("") + "</span>" +
        leftNote +
      "</span>" +
      '<span class="item-side"><span class="price num">' + money(it.cost[si]) + '</span>' +
        '<button type="button" class="linklike xsmall" data-have="' + it.id + '">Have it</button></span>' +
    "</li>";
  }
  function shortName(n) { return n; }
  function buyText(it) {
    return it.ing.pl === "each" ? fmtQty(it.pkgs, it.ing) : it.pkgs + " × " + esc(it.ing.pl);
  }

  function listText() {
    var list = buildList(state.plan);
    var lines = ["Basketwise grocery list (" + state.plan.length + " meals, " + state.household + " people)", ""];
    BW.AISLES.forEach(function (a) {
      var items = list.items.filter(function (it) { return !it.have && it.ing.a === a.id; });
      if (!items.length) return;
      lines.push(a.label.toUpperCase());
      items.forEach(function (it) {
        lines.push((state.cart.indexOf(it.id) >= 0 ? "[x] " : "[ ] ") + it.ing.n + " (" + buyText(it) + ")");
      });
      lines.push("");
    });
    lines.push("Meals: " + state.plan.map(function (p) { return DAYS[p.day].slice(0, 3) + " " + byId[p.recipe].name; }).join("; "));
    return lines.join("\n");
  }

  // ---------- Nutrition ----------

  function renderNutrition() {
    var body = document.getElementById("nutriBody");
    if (!state.plan.length) {
      body.innerHTML = emptyState("No meals yet", "Plan a few meals and we'll add up carbs, protein, fiber, vitamins and minerals for each person.");
      return;
    }
    var wk = weekNutrition();
    var share = wk.meals / 3; // each planned meal is about a third of a day
    var carbGoal = BW.CARB_GOALS[state.carbGoal].g;
    document.getElementById("nutriSub").textContent = "Per person, from " + wk.meals + " planned meal" + (wk.meals === 1 ? "" : "s") +
      ". Each meal is compared with about a third of a day's needs.";

    var rows = NUT.map(function (n) {
      var amt = wk.total[n.key];
      var target = (n.key === "carb" ? carbGoal : n.dv) * share;
      var pct = target ? amt / target * 100 : 0;
      var status, cls;
      if (n.kind === "limit") {
        status = pct <= 100 ? "Within limit" : "Over limit"; cls = pct <= 100 ? "ok" : "bad";
      } else if (n.kind === "carb") {
        status = pct < 70 ? "Under goal" : pct <= 115 ? "On goal" : "Over goal"; cls = pct < 70 ? "info" : pct <= 115 ? "ok" : "bad";
      } else if (n.kind === "energy") {
        status = pct < 70 ? "Light" : pct <= 120 ? "About right" : "Hearty"; cls = "info";
      } else {
        status = pct < 70 ? "Low" : pct < 100 ? "Almost there" : "Met"; cls = pct < 70 ? "low" : pct < 100 ? "near" : "ok";
      }
      return { n: n, amt: amt, target: target, pct: pct, status: status, cls: cls };
    });

    var carbRow = rows.filter(function (r) { return r.n.key === "carb"; })[0];
    var fibTotal = wk.total.fib;
    var avgCarb = wk.total.carb / wk.meals;
    var netCarb = (wk.total.carb - fibTotal) / wk.meals;

    var html = '<div class="carb-card card">' +
      '<div><p class="eyebrow">Carbs per meal, average</p><p class="big num">' + Math.round(avgCarb) + ' g</p><p class="small muted">≈ ' + fmtNum(Math.round(avgCarb / 15 * 2) / 2) + " carb choices (15 g each)</p></div>" +
      '<div><p class="eyebrow">Net carbs per meal</p><p class="big num">' + Math.round(netCarb) + ' g</p><p class="small muted">Carbs minus fiber</p></div>' +
      '<div><p class="eyebrow">Carbs this week</p><p class="big num">' + Math.round(wk.total.carb) + ' g</p><p class="small muted">' + Math.round(carbRow.pct) + "% of your " + BW.CARB_GOALS[state.carbGoal].label.toLowerCase() + " goal for these meals</p></div>" +
    "</div>";

    html += '<div class="nutri-grid"><div class="card nutri-card"><h2 class="h5">Daily needs covered</h2><ul class="bars">' + rows.map(function (r) {
      var w = Math.min(100, r.pct);
      return '<li class="bar-row ' + r.cls + '">' +
        '<div class="bar-label"><span>' + r.n.label + '</span><span class="num">' + round(r.amt) + " " + r.n.unit + ' <span class="muted">/ ' + round(r.target) + "</span></span></div>" +
        '<div class="meter" role="img" aria-label="' + r.n.label + ": " + Math.round(r.pct) + "% of target, " + r.status + '"><span style="width:' + w + '%"></span>' + (r.pct > 100 ? '<i class="over" aria-hidden="true"></i>' : "") + "</div>" +
        '<div class="bar-status xsmall"><span class="pill">' + statusIcon(r.cls) + " " + r.status + '</span><span class="num muted">' + Math.round(r.pct) + "%</span></div>" +
      "</li>";
    }).join("") + "</ul></div>";

    // Gaps + fixes
    var gaps = rows.filter(function (r) { return (r.n.kind === "get" && r.pct < 70); })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, 3);
    var over = rows.filter(function (r) { return (r.n.kind === "limit" || r.n.kind === "carb") && r.pct > (r.n.kind === "carb" ? 115 : 100); });
    html += '<div class="card nutri-card"><h2 class="h5">Fill the gaps</h2>';
    if (!gaps.length && !over.length) {
      html += '<p class="small"><strong>✓ Nicely balanced.</strong> Your planned meals cover every nutrient we track.</p>';
    }
    gaps.forEach(function (g) {
      var picks = RECIPES.filter(function (r) { return state.plan.every(function (p) { return p.recipe !== r.id; }); })
        .sort(function (a, b) { return perServing(b)[g.n.key] - perServing(a)[g.n.key]; }).slice(0, 2);
      html += '<div class="gap"><p class="small"><strong>' + g.n.label + " is low</strong> (" + Math.round(g.pct) + "% of target). " + gapTip(g.n.key) + "</p><ul class=\"suggest-list\">" +
        picks.map(function (r) { return suggestItem(r, round(perServing(r)[g.n.key]) + " " + g.n.unit + " " + g.n.label.toLowerCase() + " per serving"); }).join("") + "</ul></div>";
    });
    over.forEach(function (o) {
      html += '<div class="gap"><p class="small"><strong>' + o.n.label + " is high</strong> (" + Math.round(o.pct) + "% of target). " + overTip(o.n.key) + "</p></div>";
    });
    html += "</div></div>";

    // Per-day table
    html += '<div class="card table-card"><h2 class="h5">Day by day, per person</h2><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Day</th><th scope="col">Meals</th><th scope="col">Calories</th><th scope="col">Carbs</th><th scope="col">Protein</th><th scope="col">Fiber</th><th scope="col">Sodium</th></tr></thead><tbody>' +
      wk.byDay.map(function (d, i) {
        if (!d.meals) return '<tr class="muted"><th scope="row">' + DAYS[i] + '</th><td class="num">0</td><td colspan="5">Nothing planned</td></tr>';
        return '<tr><th scope="row">' + DAYS[i] + '</th><td class="num">' + d.meals + '</td><td class="num">' + Math.round(d.kcal) + '</td><td class="num">' + Math.round(d.carb) + ' g</td><td class="num">' + Math.round(d.pro) + ' g</td><td class="num">' + Math.round(d.fib) + ' g</td><td class="num">' + Math.round(d.na) + " mg</td></tr>";
      }).join("") + "</tbody></table></div></div>";

    body.innerHTML = html;
  }
  function statusIcon(cls) { return { ok: "✓", near: "◐", low: "↓", bad: "↑", info: "•" }[cls] || ""; }
  function gapTip(key) {
    return {
      pro: "Beans, lentils, eggs, Greek yogurt and chicken are easy wins.",
      fib: "Beans, lentils, whole grains and vegetables add fiber.",
      ca: "Dairy, leafy greens and beans help here.",
      fe: "Lentils, beans, spinach and beef are good sources.",
      k: "Potatoes, beans, lentils, spinach and bananas are high in potassium.",
      vc: "Bell peppers, broccoli and citrus are packed with vitamin C.",
      va: "Sweet potatoes, carrots and spinach are rich in vitamin A.",
    }[key] || "";
  }
  function overTip(key) {
    return {
      na: "Rinse canned beans (cuts sodium by about a third), choose no-salt-added tomatoes, and go easy on salsa, soy sauce and cheese.",
      fat: "Use a little less oil and cheese, or swap in leaner proteins like chicken breast or turkey.",
      carb: "Try smaller portions of rice, pasta or tortillas, or swap in a lower-carb recipe.",
    }[key] || "";
  }

  // ---------- Stores ----------

  function renderStores(list) {
    var body = document.getElementById("storeBody");
    if (!state.plan.length) {
      body.innerHTML = emptyState("Nothing to compare yet", "Once you pick recipes, we'll price your exact list at each store.");
      return;
    }
    var order = STORES.map(function (s, i) { return i; }).sort(function (a, b) { return list.totals[a] - list.totals[b]; });
    var best = list.totals[order[0]], worst = list.totals[order[order.length - 1]];
    var html = '<p class="headline">' + '<strong>' + STORES[order[0]].name + " is " + money(worst - best) + " cheaper</strong> for your list this week.</p>";
    html += '<div class="store-grid">' + order.map(function (si, rank) {
      var diff = list.totals[si] - best;
      return '<article class="store card' + (rank === 0 ? " best" : "") + '">' +
        (rank === 0 ? '<span class="badge badge-gold">★ Best store this week</span>' : '<span class="badge">#' + (rank + 1) + "</span>") +
        '<h2 class="h4">' + STORES[si].name + "</h2>" +
        '<p class="store-total num">' + money(list.totals[si]) + "</p>" +
        '<p class="small ' + (rank === 0 ? "save" : "muted") + '">' + (rank === 0 ? "Saves " + money(worst - best) + " vs. the most expensive store" : "+" + money(diff) + " more") + "</p>" +
        '<button type="button" class="btn btn-sm ' + (storeIdx(list) === si ? "btn-primary" : "btn-ghost") + '" data-store="' + STORES[si].id + '">' + (storeIdx(list) === si ? "✓ Shopping here" : "Shop here") + "</button>" +
      "</article>";
    }).join("") + "</div>";

    var items = list.items.filter(function (it) { return !it.have; }).sort(function (a, b) { return a.ing.n.localeCompare(b.ing.n); });
    html += '<div class="card table-card"><h2 class="h5">Item by item</h2><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Item</th>' +
      STORES.map(function (s) { return '<th scope="col" class="num-col">' + s.name + "</th>"; }).join("") + "</tr></thead><tbody>" +
      items.map(function (it) {
        var min = Math.min.apply(null, it.cost);
        return "<tr><th scope=\"row\">" + esc(it.ing.n) + ' <span class="xsmall muted">' + buyText(it) + "</span></th>" +
          it.cost.map(function (c) { return '<td class="num num-col' + (c === min ? " cheapest" : "") + '">' + money(c) + (c === min ? ' <span class="sr-only">(cheapest)</span>' : "") + "</td>"; }).join("") + "</tr>";
      }).join("") +
      '</tbody><tfoot><tr><th scope="row">Total</th>' + STORES.map(function (s, i) { return '<td class="num num-col">' + money(list.totals[i]) + "</td>"; }).join("") + "</tr></tfoot></table></div>" +
      '<p class="xsmall muted">Sample price estimates for comparison. Live store prices are coming soon.</p></div>';
    body.innerHTML = html;
  }

  function emptyState(title, text) {
    return '<div class="empty card"><p class="h5">' + title + '</p><p class="muted">' + text + '</p><button type="button" class="btn btn-primary" data-tab="plan">Pick recipes</button></div>';
  }

  // ---------- Recipe dialog ----------

  var dialog = document.getElementById("recipeDialog");
  function openRecipe(id) {
    var r = byId[id];
    var ps = perServing(r);
    var f = state.household / r.serves;
    var list = buildList(state.plan);
    document.getElementById("dlgBody").innerHTML =
      '<div class="dlg-head"><span class="recipe-emoji lg" aria-hidden="true">' + r.emoji + '</span><div><p class="eyebrow">' + MEAL_LABEL[r.meal] + " · " + r.mins + " min · serves " + state.household + '</p><h2 id="dlgTitle" class="h3">' + esc(r.name) + '</h2></div>' +
      '<button type="button" class="icon-btn dlg-close" data-close aria-label="Close">✕</button></div>' +
      '<div class="recipe-tags">' + r.tags.map(function (t) { return '<span class="badge">' + BW.TAGS[t] + "</span>"; }).join("") + "</div>" +
      '<div class="dlg-cols"><div>' +
        '<h3 class="h6">Ingredients</h3><ul class="ing-list">' + r.ing.map(function (p) {
          var ing = ING[p[0]], onList = list.map[p[0]] && state.plan.length;
          return "<li><span>" + esc(ing.n) + '</span><span class="num muted">' + fmtQty(p[1] * f, ing) + "</span>" +
            (onList && !ing.staple ? '<span class="badge badge-green" title="Already on your list">♻ on list</span>' : "") + "</li>";
        }).join("") + "</ul>" +
        '<h3 class="h6">Steps</h3><ol class="steps">' + r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
      "</div><div>" +
        '<div class="facts"><h3 class="h6">Nutrition per serving</h3>' +
        '<p class="facts-carb"><span class="num big">' + Math.round(ps.carb) + ' g</span> carbs · <span class="num">' + Math.round(ps.carb - ps.fib) + " g</span> net · ≈ " + fmtNum(Math.round(ps.carb / 15 * 2) / 2) + " carb choices</p>" +
        '<table class="facts-table"><thead><tr><th scope="col">Nutrient</th><th scope="col" class="num-col">Amount</th><th scope="col" class="num-col">% DV</th></tr></thead><tbody>' +
        NUT.map(function (n) {
          return "<tr><th scope=\"row\">" + n.label + '</th><td class="num num-col">' + round(ps[n.key]) + " " + n.unit + '</td><td class="num num-col">' + Math.round(ps[n.key] / n.dv * 100) + "%</td></tr>";
        }).join("") + "</tbody></table>" +
        '<p class="xsmall muted">% Daily Value is based on a 2,000-calorie day. Estimates.</p></div>' +
        '<p class="small muted">About ' + money(costPerServing(r)) + " per serving</p>" +
      "</div></div>" +
      '<div class="dlg-foot"><label class="field inline"><span class="field-label">Add to</span><select class="select" id="dlgDay">' +
        DAYS.map(function (d, i) { return '<option value="' + i + '">' + d + "</option>"; }).join("") + "</select></label>" +
        '<button type="button" class="btn btn-primary" data-add-day="' + r.id + '">Add to week</button></div>';
    var firstFree = DAYS.findIndex(function (_, d) { return !state.plan.some(function (p) { return p.day === d && p.meal === r.meal; }); });
    document.getElementById("dlgDay").value = String(firstFree >= 0 ? firstFree : 0);
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
  }
  function closeDialog() { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); }

  // ---------- Events ----------

  function setTab(tab) {
    state.tab = tab;
    animateList = tab === "list";
    render();
    window.scrollTo({ top: 0 });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, [data-open]");
    if (!t) return;
    var d = t.dataset;
    if (d.tab) { setTab(d.tab); return; }
    if (d.add) { if (addRecipe(d.add)) render(); return; }
    if (d.addDay) { if (addRecipe(d.addDay, Number(document.getElementById("dlgDay").value))) { closeDialog(); render(); } return; }
    if (d.open) { openRecipe(d.open); return; }
    if (d.remove) { removeEntry(Number(d.remove)); render(); return; }
    if (d.have) { toggleHave(d.have); render(); return; }
    if (d.store) { state.store = d.store; render(); toast("Your list is now priced at " + STORES.find(function (s) { return s.id === d.store; }).name + "."); return; }
    if (d.step) {
      state.household = Math.max(1, Math.min(12, state.household + Number(d.step)));
      render(); return;
    }
    if (d.meal) { ui.meal = d.meal; renderFilters(); render(); return; }
    if (d.tag) {
      var i = ui.tags.indexOf(d.tag);
      if (i >= 0) ui.tags.splice(i, 1); else ui.tags.push(d.tag);
      renderFilters(); render(); return;
    }
    if (d.close !== undefined) { closeDialog(); return; }
    if (t.id === "clearPlan") {
      if (!state.plan.length || confirm("Clear every meal from this week?")) { state.plan = []; state.cart = []; render(); }
      return;
    }
    if (t.id === "autoPlan") { autoPlan(); render(); return; }
    if (t.id === "resetCart") { state.cart = []; render(); return; }
    if (t.id === "printList") { window.print(); return; }
    if (t.id === "copyList") {
      var text = listText();
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        navigator.share({ title: "Grocery list", text: text }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () { toast("List copied. Paste it anywhere."); }, function () { toast("Couldn't copy. Try Print instead."); });
      }
      return;
    }
  });

  // Close the dialog when clicking the backdrop.
  dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.cart) {
      var id = t.dataset.cart;
      if (t.checked) { if (state.cart.indexOf(id) < 0) state.cart.push(id); }
      else state.cart = state.cart.filter(function (x) { return x !== id; });
      render();
      var list = buildList(state.plan);
      var left = list.items.filter(function (it) { return !it.have && state.cart.indexOf(it.id) < 0; }).length;
      if (t.checked && left === 0) toast("🎉 List complete! Enjoy a week without the 5 p.m. scramble.");
      return;
    }
    if (t.dataset.move) {
      var entry = state.plan.find(function (p) { return p.id === Number(t.dataset.move); });
      if (entry) { entry.day = Number(t.value); sortPlan(); render(); toast("Moved to " + DAYS[entry.day] + "."); }
      return;
    }
    if (t.id === "carbGoal") { state.carbGoal = t.value; render(); return; }
    if (t.id === "listStore") { state.store = t.value; render(); return; }
  });

  document.getElementById("search").addEventListener("input", function (e) {
    ui.query = e.target.value.trim();
    render();
  });

  // Arrow-key navigation between tabs.
  document.addEventListener("keydown", function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    var i = TABS.findIndex(function (t) { return t.id === tab.dataset.tab; });
    var next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
    var prefix = tab.id.indexOf("tabb-") === 0 ? "tabb-" : "tab-";
    setTab(next);
    document.getElementById(prefix + next).focus();
  });

  // ---------- Init ----------

  document.getElementById("carbGoal").innerHTML = Object.keys(BW.CARB_GOALS).map(function (k) {
    return '<option value="' + k + '"' + (state.carbGoal === k ? " selected" : "") + ">" + BW.CARB_GOALS[k].label + "</option>";
  }).join("");
  var hash = location.hash.replace("#", "");
  if (TABS.some(function (t) { return t.id === hash; })) state.tab = hash;
  renderFilters();
  render();
})();
