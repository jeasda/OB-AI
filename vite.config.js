import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'frontend'),
  publicDir: resolve(__dirname, 'frontend', 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        qwen: resolve(__dirname, 'frontend', 'services', 'qwen-image-edit', 'index.html')
      }
    }
  },
  server: {
    open: '/services/qwen-image-edit'
  }
})
