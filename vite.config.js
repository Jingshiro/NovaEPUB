import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        // 大依赖手动分包：TipTap(ProseMirror) 与 JSZip 各自成块，避免首屏超大 chunk
        manualChunks: {
          tiptap: ['@tiptap/vue-3', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-placeholder'],
          jszip: ['jszip'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  },
})
