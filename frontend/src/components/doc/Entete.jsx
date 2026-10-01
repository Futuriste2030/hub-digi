/* Papier à en-tête officiel — images découpées du fichier Entete-Digi.pdf.
   Haut en ouverture de document, bas en fermeture. Lié aux Paramètres. */

export default function Entete({ entreprise }) {
  if (entreprise.entete?.haut) {
    return (
      <img
        src={entreprise.entete.haut}
        alt={`En-tête ${entreprise.raison}`}
        className="block w-full"
      />
    );
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-esp-4 border-b-2 border-marine-profond pb-esp-4">
      <span className="font-titrage text-[15px] font-extrabold tracking-[0.06em] text-gris-900">{entreprise.raison}</span>
      <span className="text-right font-courant text-[13px] text-gris-600">
        <span className="block">{entreprise.adresse}</span>
        <span className="block dg-tnum">{entreprise.phone}</span>
      </span>
    </div>
  );
}

export function PiedEntete({ entreprise }) {
  if (!entreprise.entete?.bas) return null;
  return (
    <img
      src={entreprise.entete.bas}
      alt="Pied de page officiel"
      className="mt-esp-6 block w-full"
    />
  );
}
