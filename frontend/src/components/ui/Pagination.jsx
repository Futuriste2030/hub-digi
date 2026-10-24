import { ChevronLeft, ChevronRight } from 'lucide-react';

/* Pagination — listes longues (inscriptions, attestations…).
   Le filtrage reste inchangé : la pagination s'applique à la liste filtrée. */
export default function Pagination({ page, totalPages, total, libelle = 'élément(s)', onChange }) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="px-esp-4 py-esp-3 text-center font-courant text-[13px] text-gris-500">
        {total} {libelle}
      </p>
    ) : null;
  }

  const pages = [];
  const fenetre = 2;
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= fenetre) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-esp-3 border-t border-gris-200 px-esp-4 py-esp-3"
    >
      <p className="font-courant text-[13px] text-gris-600">
        Page <strong className="text-gris-900">{page}</strong> sur {totalPages} · {total} {libelle}
      </p>
      <span className="flex items-center gap-esp-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className="flex h-9 min-h-[36px] w-9 items-center justify-center rounded-md border border-gris-300 bg-gris-0 text-gris-700 transition-colors hover:bg-gris-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pages.map((p, i) => (
          p === '…' ? (
            <span key={`sep-${i}`} className="px-esp-1 font-courant text-[13px] text-gris-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-9 min-h-[36px] min-w-[36px] rounded-md border px-esp-2 font-courant text-[14px] font-semibold transition-colors ${
                p === page
                  ? 'border-digi bg-digi text-blanc'
                  : 'border-gris-300 bg-gris-0 text-gris-700 hover:bg-gris-100'
              }`}
            >
              {p}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Page suivante"
          className="flex h-9 min-h-[36px] w-9 items-center justify-center rounded-md border border-gris-300 bg-gris-0 text-gris-700 transition-colors hover:bg-gris-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </span>
    </nav>
  );
}
