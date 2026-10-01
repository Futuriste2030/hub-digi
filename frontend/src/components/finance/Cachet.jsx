/* Cachet société — images importées dans Paramètres (cachet + signature superposée),
   repli sur le tampon circulaire fictif si aucun fichier. */

export default function Cachet({ entreprise, mention = 'Bamako — Mali', cachetUrl, signatureUrl }) {
  const raison = entreprise?.raison ?? 'Digi Com & Technologies';
  const phone = entreprise?.phone ?? '(+223) 70 16 33 86';

  if (cachetUrl) {
    return (
      <span className="relative inline-block h-36 w-36 shrink-0" role="img" aria-label={`Cachet ${raison}`}>
        <img src={cachetUrl} alt={`Cachet ${raison}`} className="h-full w-full object-contain opacity-90" />
        {signatureUrl && (
          <img
            src={signatureUrl}
            alt="Signature superposée"
            className="absolute inset-0 m-auto h-3/5 w-auto rotate-[-8deg] object-contain opacity-90"
          />
        )}
      </span>
    );
  }

  if (signatureUrl) {
    return (
      <img src={signatureUrl} alt={`Signature ${raison}`} role="img" className="h-24 w-auto shrink-0 rotate-[-8deg] object-contain" />
    );
  }

  return (
    <div
      aria-label={`Cachet ${raison}`}
      role="img"
      className="relative flex h-36 w-36 shrink-0 rotate-[-12deg] items-center justify-center rounded-full opacity-80"
      style={{
        border: '4px solid var(--bleu-digi)',
        color: 'var(--bleu-digi)',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-1.5 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 text-center"
        style={{ border: '2px solid var(--bleu-digi)' }}
      >
        <span className="font-titrage text-[10px] font-extrabold uppercase leading-tight tracking-[0.08em]">
          {raison}
        </span>
        <span aria-hidden="true" className="font-courant text-[10px] leading-none">
          ★ ★ ★
        </span>
        <span className="font-courant text-[10px] font-semibold leading-tight">{mention}</span>
        <span className="font-courant text-[9px] leading-tight dg-tnum">{phone}</span>
      </div>
    </div>
  );
}
