import { libelleNiveau, NIVEAUX } from '../../data/niveaux.js';

/* Badge de niveau hiérarchique — toujours couleur + libellé, jamais chiffre nu.
   Couleurs : --niveau-0…6 (src/index.css :root). Contraste AA vérifié. */

export default function BadgeNiveau({ niveau }) {
  const n = NIVEAUX.find((x) => x.niveau === niveau);
  const libelle = n ? n.libelle : libelleNiveau(niveau);
  const clair = niveau === 2;
  return (
    <span
      className="inline-flex min-h-[24px] items-center gap-esp-1 rounded-pilule px-esp-3 py-esp-1 font-courant text-[13px] font-semibold tracking-[0.04em]"
      style={{
        background: `var(--niveau-${niveau ?? 0})`,
        color: clair ? 'var(--marine-profond)' : 'var(--blanc-pur)',
      }}
    >
      <span aria-hidden="true" className="dg-tnum">N{niveau ?? '—'}</span>
      <span aria-hidden="true">·</span> {libelle}
    </span>
  );
}
