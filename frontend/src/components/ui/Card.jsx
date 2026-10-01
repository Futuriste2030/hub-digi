/* Carte charte §6 : rayon 8px, filet 1px gris-300, ombre-1 repos.
   Survol ombre-3 désactivable (survol=false) pour les écrans denses type dashboard. */
export function Card({ children, className = '', miseEnAvant = false, sourde = false, survol = true, ...props }) {
  return (
    <div
      className={`rounded-lg border bg-gris-0 shadow-ombre-1 transition-shadow duration-standard ${
        survol ? 'hover:shadow-ombre-3' : ''
      } ${
        sourde ? 'border-white/10 bg-marine text-blanc' : 'border-gris-300'
      } ${miseEnAvant ? 'dg-carte-mise-en-avant' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`p-esp-5 pb-esp-3 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`px-esp-5 pb-esp-5 ${className}`}>{children}</div>;
}
