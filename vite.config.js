import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  },
})
