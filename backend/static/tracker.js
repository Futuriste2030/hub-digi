/* HUB DIGI tracker.js V1 (~3 Ko) — SPEC §9 : auto-capture erreurs JS + widget "Signaler un bug".
   Usage : <script src="https://hub.digicom.ml/static/tracker.js" data-key="digi_pub_xxx"></script> */
(function () {
  var el = document.currentScript;
  var KEY = el && el.getAttribute("data-key");
  if (!KEY) return;
  var ENDPOINT = el.src.replace(/\/static\/tracker\.js.*$/, "/api/v1/bugs/report/");

  function envoyer(payload) {
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ key: KEY }, payload)),
      }).catch(function () {});
    } catch (e) {}
  }

  window.addEventListener("error", function (e) {
    envoyer({
      message: String(e.message || "Erreur JS").slice(0, 255),
      stack: String((e.error && e.error.stack) || "").slice(0, 2000),
      url: location.href,
      meta: { userAgent: navigator.userAgent, viewport: innerWidth + "x" + innerHeight },
    });
  });
  window.addEventListener("unhandledrejection", function (e) {
    envoyer({
      message: String((e.reason && e.reason.message) || e.reason || "Rejet non géré").slice(0, 255),
      stack: "",
      url: location.href,
      meta: { userAgent: navigator.userAgent },
    });
  });

  /* Widget manuel "Signaler un bug" : bouton flottant + formulaire minimal. */
  var btn = document.createElement("button");
  btn.textContent = "Signaler un bug";
  btn.setAttribute("style", "position:fixed;bottom:16px;right:16px;z-index:99999;padding:10px 16px;border:0;border-radius:8px;background:#2f7cbe;color:#fff;font:600 14px sans-serif;cursor:pointer;");
  btn.onclick = function () {
    var desc = prompt("Décrivez le bug :");
    if (!desc) return;
    var email = prompt("Votre e-mail (optionnel) :") || "";
    envoyer({ message: desc.slice(0, 255), stack: "", url: location.href, meta: { email: email } });
    alert("Merci, bug transmis à l'agence.");
  };
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(btn); });
})();
