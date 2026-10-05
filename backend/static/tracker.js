/* HUB DIGI tracker.js V1 (~3 Ko) — SPEC §9 : capture AUTOMATIQUE des bugs.
   Aucun widget visible : erreurs JS + rejets non gérés + ressources en échec
   (scripts, CSS, images) sont détectés seuls et envoyés au HUB avec gravité auto.
   Usage : <script src="https://hub.digicom.ml/static/tracker.js" data-key="digi_pub_xxx"></script> */
(function () {
  var el = document.currentScript;
  var KEY = el && el.getAttribute("data-key");
  if (!KEY) return;
  var ENDPOINT = el.src.replace(/\/static\/tracker\.js.*$/, "/api/v1/bugs/report/");

  /* Gravité automatique : haute = site partiellement cassé (chunk/script/CSS
     ou fetch réseau en échec), moyenne = le reste. La RH Dév requalifie. */
  function gravitePour(message, ressource) {
    var m = String(message || "").toLowerCase();
    if (ressource) {
      var url = String(ressource).toLowerCase();
      if (/\.js(\?|#|$)|\.css(\?|#|$)|chunk/.test(url)) return "haute";
      return "moyenne";
    }
    if (/failed to fetch|networkerror|load failed|loading chunk|chunkloaderror|dynamically imported module|mime type/.test(m)) return "haute";
    return "moyenne";
  }

  function envoyer(payload) {
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ key: KEY }, payload)),
      }).catch(function () {});
    } catch (e) {}
  }

  /* 1. Erreurs JS non interceptées (bouton cassé, variable introuvable…). */
  window.addEventListener("error", function (e) {
    if (e.target && e.target !== window) return; /* ressources : voir §3 */
    var message = String(e.message || "Erreur JS");
    envoyer({
      message: message.slice(0, 255),
      stack: String((e.error && e.error.stack) || "").slice(0, 2000),
      url: location.href,
      gravite: gravitePour(message),
      meta: { userAgent: navigator.userAgent, viewport: innerWidth + "x" + innerHeight },
    });
  });

  /* 2. Promesses rejetées non gérées (appels API échoués…). */
  window.addEventListener("unhandledrejection", function (e) {
    var message = String((e.reason && e.reason.message) || e.reason || "Rejet non géré");
    envoyer({
      message: message.slice(0, 255),
      stack: "",
      url: location.href,
      gravite: gravitePour(message),
      meta: { userAgent: navigator.userAgent },
    });
  });

  /* 3. Ressources en échec (script/CSS/image introuvable, chunk périmé…).
     Capture obligatoire : les erreurs de ressources ne remontent pas. */
  window.addEventListener("error", function (e) {
    var cible = e.target;
    if (!cible || cible === window) return;
    var src = cible.src || cible.href || "";
    if (!src) return;
    envoyer({
      message: ("Ressource en echec : " + src).slice(0, 255),
      stack: "",
      url: location.href,
      gravite: gravitePour("", src),
      meta: { userAgent: navigator.userAgent, tag: cible.tagName || "" },
    });
  }, true);
})();
