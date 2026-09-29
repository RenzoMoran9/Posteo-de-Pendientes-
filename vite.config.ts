import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base: './'` para que el mismo build funcione en cualquier ruta
// (GitHub Pages en subcarpeta, un dominio propio o una página de prueba).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
