import { CircleCheck, Bell, X } from 'lucide-react';

/* Toasts bas-droite, fond marine, barre de vie 4,2s. */
const TONS = {
  succes: { Icone: CircleCheck, pastille: 'bg-succes' },
  info: { Icone: Bell, pastille: 'bg-digi-signal' },
};

export default function Toasts({ toasts, fermer }) {
  return (
    <div className="fixed bottom-esp-5 right-esp-5 z-[120] flex w-[min(360px,calc(100vw-40px))] flex-col gap-esp-3" aria-live="polite">
      {toasts.map((t) => {
        const { Icone, pastille } = TONS[t.type] || TONS.info;
        return (
          <div key={t.id} className="dg-montee relative flex items-start gap-esp-3 rounded-lg bg-marine-profond py-esp-4 pl-esp-4 pr-esp-9 shadow-ombre-4">
            <div className="flex items-start gap-esp-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${pastille} text-blanc`}>
                <Icone size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-courant text-[15px] font-semibold text-blanc">{t.titre}</span>
                {t.texte && <span className="mt-0.5 block font-courant text-[15px] text-digi-brume">{t.texte}</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => fermer(t.id)}
              aria-label="Fermer la notification"
              className="absolute right-esp-2 top-esp-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-brume hover:text-blanc"
            >
              <X size={16} aria-hidden="true" />
            </button>
</div>
        );
      })}
    </div>
  );
}
