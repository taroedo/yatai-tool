(function () {
  "use strict";
  const config = window.YATAI_PORTAL_CONFIG || {};
  const storageKey = config.storageKey || "shino4-yatai-portal-access-v1";
  let unlocked = false;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    unlocked = Boolean(saved && Number(saved.expiresAt) > Date.now());
  } catch {
    localStorage.removeItem(storageKey);
  }

  if (unlocked) {
    document.documentElement.classList.add("portal-authorized");
    return;
  }

  const script = document.currentScript;
  const portalPath = script?.dataset.portal || "../index.html";
  const separator = portalPath.includes("?") ? "&" : "?";
  location.replace(`${portalPath}${separator}next=${encodeURIComponent(location.href)}`);
})();
