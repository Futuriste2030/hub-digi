import { PERMISSIONS_PAR_NIVEAU } from '../data/niveaux.js';

/* Dérivation niveau -> permissions effectives + overrides manuels.
   Signature stable : ne changera pas quand l'API arrivera
   (le backend renverra { niveau, permissionsAjustees }).
   BACKEND : GET /api/v1/users/me/ -> { niveau, permissions_effectives } */

export const permissionsDefaut = (niveau) => [...(PERMISSIONS_PAR_NIVEAU[niveau] ?? [])];

export function permissionsEffectives(niveau, overrides = {}) {
  const base = new Set(permissionsDefaut(niveau));
  Object.entries(overrides).forEach(([code, accordee]) => {
    if (accordee) base.add(code);
    else base.delete(code);
  });
  return [...base];
}

/* Vrai si la case a été modifiée à la main par rapport au défaut du niveau. */
export function estAjuste(code, niveau, overrides = {}) {
  if (!(code in overrides)) return false;
  return overrides[code] !== permissionsDefaut(niveau).includes(code);
}

export function compteurModule(codes, effectives) {
  const set = new Set(effectives);
  const cochees = codes.filter((c) => set.has(c)).length;
  return `${cochees}/${codes.length}`;
}
