/* Champs charte §6 : bordure 1px gris-300, focus bordure bleu Digi + anneau,
   erreur bordure + message explicite, désactivé opacité 55 %. */
export function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="font-courant text-[15px] font-semibold text-gris-700">
      {children}
    </label>
  );
}

export function Input({ id, erreur, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-esp-2">
      <input
        id={id}
        aria-invalid={Boolean(erreur)}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className={`h-11 min-h-[44px] rounded-md border bg-gris-0 px-esp-4 font-courant text-[17px] text-gris-700 placeholder:text-gris-400 focus:border-digi ${
          erreur ? 'border-erreur' : 'border-gris-300'
        } disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
        {...props}
      />
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="font-courant text-[15px] text-erreur">
          {erreur}
        </p>
      )}
    </div>
  );
}

export function Textarea({ id, erreur, maxLength = 600, value = '', className = '', ...props }) {
  const compteur = `${String(value).length} / ${maxLength}`;
  return (
    <div className="flex flex-col gap-esp-2">
      <textarea
        id={id}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(erreur)}
        className={`min-h-[120px] rounded-md border bg-gris-0 p-esp-4 font-courant text-[17px] leading-[1.6] text-gris-700 focus:border-digi ${
          erreur ? 'border-erreur' : 'border-gris-300'
        } disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
        {...props}
      />
      <div className="flex items-center justify-between">
        {erreur ? (
          <p role="alert" className="font-courant text-[15px] text-erreur">
            {erreur}
          </p>
        ) : (
          <span />
        )}
        <span className="font-mono text-[13px] text-gris-600">{compteur}</span>
      </div>
    </div>
  );
}
