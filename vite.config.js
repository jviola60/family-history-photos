import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api/fal': {
        target: 'https://fal.run',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fal/, '')
      }
    }
  }
})
