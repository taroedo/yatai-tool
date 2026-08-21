(function () {
  "use strict";
  const config = window.YATAI_PORTAL_CONFIG;
  const loginView = document.getElementById("loginView");
  const portalView = document.getElementById("portalView");
  const loginForm = document.getElementById("loginForm");
  const accessCode = document.getElementById("accessCode");
  const loginError = document.getElementById("loginError");
  const logout = document.getElementById("logout");

  function isUnlocked() {
    try {
      const saved = JSON.parse(localStorage.getItem(config.storageKey) || "null");
      return Boolean(saved && Number(saved.expiresAt) > Date.now());
    } catch {
      localStorage.removeItem(config.storageKey);
      return false;
    }
  }

  function showPortal() {
    loginView.classList.add("hidden");
    portalView.classList.remove("hidden");
  }

  function showLogin() {
    portalView.classList.add("hidden");
    loginView.classList.remove("hidden");
    accessCode.focus();
  }

  function safeNextUrl() {
    const next = new URLSearchParams(location.search).get("next");
    if (!next) return null;
    try {
      const url = new URL(next, location.href);
      return url.origin === location.origin ? url.href : null;
    } catch {
      return null;
    }
  }

  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    if (accessCode.value !== config.accessCode) {
      loginError.textContent = "アクセスコードが違います。";
      accessCode.select();
      return;
    }
    localStorage.setItem(config.storageKey, JSON.stringify({
      expiresAt: Date.now() + config.accessHours * 60 * 60 * 1000
    }));
    loginError.textContent = "";
    const next = safeNextUrl();
    if (next) {
      location.replace(next);
      return;
    }
    history.replaceState(null, "", location.pathname);
    showPortal();
  });

  logout.addEventListener("click", () => {
    localStorage.removeItem(config.storageKey);
    accessCode.value = "";
    showLogin();
  });

  if (isUnlocked()) showPortal();
  else showLogin();
})();
