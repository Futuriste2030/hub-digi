/* Logo : source de vérité /logo/logo-digi-com.png.
   Règle charte §1 : posé UNIQUEMENT sur fond marine.
   Sur fond clair -> cartouche marine plein, rayon 4px, marge interne = zone
   de protection (0,25 x hauteur). Hauteur min écran 32px. */
export default function Logo({ hauteur = 44, surClair = false, className = '' }) {
  const protection = Math.round(hauteur * 0.25);
  const img = (
    <img
      src="/logo/logo-digi-com.png"
      alt="Digi Com et Technologies"
      height={hauteur}
      style={{ height: hauteur, width: 'auto', display: 'block' }}
    />
  );
  if (!surClair) return <span className={className}>{img}</span>;
  return (
    <span
      className={className}
      style={{
        background: 'var(--marine-profond)',
        borderRadius: 'var(--rayon-md)',
        padding: protection,
        display: 'inline-flex',
      }}
    >
      {img}
    </span>
  );
}
