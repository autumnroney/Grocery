// Sign-in page: request a magic link, then show "check your email".
(function () {
  "use strict";

  var auth = BW.auth;
  var form = document.getElementById("loginForm");
  var emailInput = document.getElementById("email");
  var err = document.getElementById("emailError");
  var sendBtn = document.getElementById("sendBtn");
  var resendBtn = document.getElementById("resendBtn");
  var resendMsg = document.getElementById("resendMsg");
  var lastEmail = "";
  var cooldownTimer;

  function show(step) {
    ["stepEmail", "stepSent", "stepSignedIn"].forEach(function (id) {
      document.getElementById(id).hidden = id !== step;
    });
    var heading = document.querySelector("#" + step + " h1");
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus(); }
  }

  function friendlyError(error) {
    var msg = (error && error.message) || "";
    if (/rate limit|security purposes|seconds/i.test(msg)) return "Too many requests. Please wait a minute and try again.";
    if (/invalid/i.test(msg) && /email/i.test(msg)) return "That email address doesn't look right.";
    if (/not authorized|signups not allowed/i.test(msg)) return "Sign-ups are turned off for this site right now.";
    return msg || "Something went wrong. Please try again.";
  }

  // A one-minute cooldown matches Supabase's default limit between links.
  function cooldown(btn, label) {
    var left = 60;
    btn.disabled = true;
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(function () {
      left--;
      btn.textContent = left > 0 ? label + " (" + left + "s)" : label;
      if (left <= 0) { clearInterval(cooldownTimer); btn.disabled = false; }
    }, 1000);
  }

  function send(email, btn, label) {
    btn.disabled = true;
    btn.textContent = "Sending…";
    return auth.signIn(email).then(function (res) {
      btn.textContent = label;
      if (res.error) { btn.disabled = false; throw res.error; }
      cooldown(btn, label);
    }, function (e) { btn.disabled = false; btn.textContent = label; throw e; });
  }

  if (auth.unavailable) {
    err.textContent = "Sign-in isn't available right now. You can still use the planner without an account.";
    sendBtn.disabled = true;
    return;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.textContent = "";
    var email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      err.textContent = "Please enter a valid email address.";
      emailInput.focus();
      return;
    }
    send(email, sendBtn, "Email me a sign-in link").then(function () {
      lastEmail = email;
      document.getElementById("sentTo").textContent = email;
      resendMsg.textContent = "";
      cooldown(resendBtn, "Resend link");
      show("stepSent");
    }, function (error) {
      err.textContent = friendlyError(error);
    });
  });

  resendBtn.addEventListener("click", function () {
    resendMsg.textContent = "";
    send(lastEmail, resendBtn, "Resend link").then(function () {
      resendMsg.textContent = "Sent again. Check your inbox.";
    }, function (error) {
      resendMsg.textContent = friendlyError(error);
    });
  });

  document.getElementById("changeEmail").addEventListener("click", function () {
    show("stepEmail");
    emailInput.select();
  });

  // Expired or already-used links come back with an error in the URL.
  var params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  if (params.get("error_description")) {
    err.textContent = /expired|invalid/i.test(params.get("error_description"))
      ? "That sign-in link has expired or was already used. Enter your email to get a new one."
      : params.get("error_description").replace(/\+/g, " ");
    history.replaceState(null, "", location.pathname);
  }

  auth.onChange(function (user) {
    if (user) {
      document.getElementById("signedInAs").textContent = user.email;
      show("stepSignedIn");
    }
  });
})();
