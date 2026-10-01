/** @type {import('tailwindcss').Config} */
/* Charte DIGI COM — aucun littéral hors var(--…) dans les composants.
   Les hexadécimaux n'existent qu'en source dans src/index.css :root. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: {
      xs: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      xxl: '1440px',
    },
    extend: {
      colors: {
        marine: {
          profond: 'var(--marine-profond)',
          DEFAULT: 'var(--marine)',
          clair: 'var(--marine-clair)',
          footer: 'var(--marine-footer)',
        },
        digi: {
          DEFAULT: 'var(--bleu-digi)',
          signal: 'var(--bleu-signal)',
          profond: 'var(--bleu-profond)',
          texte: 'var(--bleu-texte)',
          brume: 'var(--bleu-brume)',
          voile: 'var(--bleu-voile)',
        },
        ardoise: 'var(--ardoise)',
        argent: 'var(--argent)',
        blanc: 'var(--blanc-pur)',
        gris: {
          900: 'var(--gris-900)',
          800: 'var(--gris-800)',
          700: 'var(--gris-700)',
          600: 'var(--gris-600)',
          500: 'var(--gris-500)',
          400: 'var(--gris-400)',
          300: 'var(--gris-300)',
          200: 'var(--gris-200)',
          100: 'var(--gris-100)',
          0: 'var(--gris-000)',
        },
        succes: { DEFAULT: 'var(--succes)', lumineux: 'var(--succes-lumineux)', fond: 'var(--succes-fond)' },
        alerte: { DEFAULT: 'var(--alerte)', lumineux: 'var(--alerte-lumineux)', fond: 'var(--alerte-fond)' },
        erreur: { DEFAULT: 'var(--erreur)', lumineux: 'var(--erreur-lumineux)', fond: 'var(--erreur-fond)' },
        info: { DEFAULT: 'var(--info)', lumineux: 'var(--info-lumineux)', fond: 'var(--info-fond)' },
      },
      spacing: {
        'esp-1': 'var(--esp-1)',
        'esp-2': 'var(--esp-2)',
        'esp-3': 'var(--esp-3)',
        'esp-4': 'var(--esp-4)',
        'esp-5': 'var(--esp-5)',
        'esp-6': 'var(--esp-6)',
        'esp-7': 'var(--esp-7)',
        'esp-8': 'var(--esp-8)',
        'esp-9': 'var(--esp-9)',
        'esp-10': 'var(--esp-10)',
      },
      borderRadius: {
        sm: 'var(--rayon-sm)',
        md: 'var(--rayon-md)',
        lg: 'var(--rayon-lg)',
        xl: 'var(--rayon-xl)',
        pilule: 'var(--rayon-pilule)',
      },
      boxShadow: {
        'ombre-1': 'var(--ombre-1)',
        'ombre-2': 'var(--ombre-2)',
        'ombre-3': 'var(--ombre-3)',
        'ombre-4': 'var(--ombre-4)',
        'ombre-bleue': 'var(--ombre-bleue)',
        focus: 'var(--anneau-focus)',
      },
      fontFamily: {
        titrage: ['Montserrat', 'Poppins', 'Archivo', 'sans-serif'],
        courant: ['Barlow', 'Source Sans 3', 'IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      maxWidth: {
        grille: 'var(--grille-largeur-max)',
      },
      transitionDuration: {
        rapide: 'var(--duree-rapide)',
        standard: 'var(--duree-standard)',
        lente: 'var(--duree-lente)',
      },
    },
  },
  plugins: [],
};
