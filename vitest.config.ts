import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // jsdom is the default: setup.ts imports @testing-library/jest-dom (needs
    // document), and most tests render React components. Pure-logic tests are
    // unaffected by the DOM environment. Individual files can opt out with a
    // `// @vitest-environment node` directive if needed.
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
