import { useEffect, useRef } from 'react';

/* Ferme un menu déroulant au clic hors de sa zone. */
export default function useClickOutside(fermer) {
  const ref = useRef(null);
  const fnRef = useRef(fermer);
  useEffect(() => {
    fnRef.current = fermer;
  }, [fermer]);
  useEffect(() => {
    const clic = (e) => {
      if (ref.current && !ref.current.contains(e.target)) fnRef.current(e);
    };
    document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, []);
  return ref;
}
