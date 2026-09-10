import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
        'supabase/**',
        'dist/**',
      ],
    },
  },
})
