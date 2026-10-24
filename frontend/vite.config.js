import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/docs/config/
export default defineConfig({
  plugins: [react()],
  // Port figé : un vieux Service Worker inconnu pollue localhost:5173,
  // on sert le hub sur 5199 (origine neuve, aucun SW enregistré).
  server: {
    port: 5199,
    strictPort: true,
    // Sans ça Vite 8 bloque le tunnel ngrok ("Blocked request. This host is
    // not allowed.") : le Host reçu via le tunnel n'est ni localhost ni une IP.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    // ngrok Free n'accorde qu'UN domaine par compte : impossible d'exposer
    // l'API et le SPA sur deux tunnels distincts (ils se marchent dessus).
    // On expose donc un seul tunnel (Vite) et Vite relaie le backend Django.
    // Bonus : SPA et API partagent la même origine -> plus de CORS/CSRF en dev.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/admin': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
