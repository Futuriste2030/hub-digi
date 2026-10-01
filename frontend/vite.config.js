import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Port figé : un vieux Service Worker inconnu pollue localhost:5173,
  // on sert le hub sur 5199 (origine neuve, aucun SW enregistré).
  server: { port: 5199, strictPort: true },
})
