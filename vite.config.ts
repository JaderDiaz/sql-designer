import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * Configuración de Vite para el frontend de SQL Designer.
 * El servidor usa un puerto fijo porque Tauri lo abre en la ventana nativa.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
})
