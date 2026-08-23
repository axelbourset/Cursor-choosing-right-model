import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { serveSnapshot } from './vite.plugins'

export default defineConfig({
  plugins: [react(), serveSnapshot()],
  base: './',
  resolve: {
    alias: {
      '@schema': fileURLToPath(new URL('./schema', import.meta.url)),
      '@domain': fileURLToPath(new URL('./domain', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
})
