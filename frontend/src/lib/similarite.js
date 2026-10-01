/* Matching flou anti-doublon — suggestion « Vouliez-vous dire… ? »
   sur le catalogue des postes (étape 2, poste personnalisé).
   Normalisation + distance de Levenshtein, seuil relatif à la longueur. */

export const normaliser = (s) => String(s)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export function levenshtein(a, b) {
  const A = normaliser(a);
  const B = normaliser(b);
  if (A === B) return 0;
  if (A.length === 0) return B.length;
  if (B.length === 0) return A.length;
  const ligne = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    let prec = ligne[0];
    ligne[0] = i;
    for (let j = 1; j <= B.length; j++) {
      const cout = A[i - 1] === B[j - 1] ? 0 : 1;
      const cur = Math.min(ligne[j] + 1, ligne[j - 1] + 1, prec + cout);
      prec = ligne[j];
      ligne[j] = cur;
    }
  }
  return ligne[B.length];
}

/* Meilleure correspondance du catalogue, ou null si rien d'assez proche.
   Seuil : distance <= 3 ou <= 30 % de la plus grande longueur. */
export function suggestionPoste(saisie, catalogue) {
  const n = normaliser(saisie);
  if (n.length < 3) return null;
  let meilleur = null;
  let meilleureDist = Infinity;
  catalogue.forEach((p) => {
    const d = levenshtein(n, p.libelle);
    if (d < meilleureDist) {
      meilleureDist = d;
      meilleur = p;
    }
  });
  if (!meilleur || meilleureDist === 0) return null;
  const seuil = Math.max(3, Math.floor(Math.max(n.length, normaliser(meilleur.libelle).length) * 0.3));
  return meilleureDist <= seuil ? { poste: meilleur, distance: meilleureDist } : null;
}
