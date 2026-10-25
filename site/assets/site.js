// MESHORA — comportements du site (partage, installation). Aucun appel réseau, aucun traceur.
(function () {
  "use strict";
  var lang = document.documentElement.lang === "en" ? "en" : "fr";
  var T = {
    fr: { copied: "Lien copié", shareTitle: "MESHORA", shareText: "Un réseau qui relie les autres." },
    en: { copied: "Link copied", shareTitle: "MESHORA", shareText: "A network that connects the others." }
  }[lang];

  // Hygiène d'adresse : retire utm_* et identifiants de clic publicitaires de l'adresse affichée
  // et des liens partagés ; les paramètres fonctionnels et le fragment sont conservés.
  var TRACK = /^(utm_.*|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|twclid|ttclid|li_fat_id)$/i;
  function cleanUrl(href) {
    try {
      var u = new URL(href, location.href);
      var drop = [];
      u.searchParams.forEach(function (_v, k) { if (TRACK.test(k)) drop.push(k); });
      drop.forEach(function (k) { u.searchParams.delete(k); });
      return u.toString().replace(/\?(?=#|$)/, "");
    } catch (e) { return href; }
  }
  var cleaned = cleanUrl(location.href);
  if (cleaned !== location.href && history.replaceState) {
    try { history.replaceState(history.state, "", cleaned); } catch (e) {}
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // Partage : feuille de partage du système, sinon copie du lien.
  document.querySelectorAll("[data-share]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = cleanUrl(btn.getAttribute("data-share-url") || location.href);
      if (navigator.share) {
        navigator.share({ title: T.shareTitle, text: T.shareText, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast(T.copied); }, function () {});
      } else {
        window.prompt(T.copied, url);
      }
    });
  });

  // Installation : bouton seulement si le navigateur propose réellement l'installation.
  var deferred = null;
  var installBtn = document.querySelector("[data-install]");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) {
    installBtn.addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; installBtn.hidden = true; });
    });
  }

  // Instructions adaptées à la plateforme détectée (affichage seulement).
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  document.querySelectorAll("[data-platform]").forEach(function (el) {
    var p = el.getAttribute("data-platform");
    if (p === "ios" && isIOS && !standalone) el.hidden = false;
    if (p === "installed" && standalone) el.hidden = false;
  });
})();
