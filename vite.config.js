import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Content-Security-Policy applied to production builds only
// (the dev server needs inline scripts for React Fast Refresh).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com https://accounts.google.com https://*.gstatic.com https://js.live.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data: https: https://*.familysearch.org https://*.identbeta.familysearch.org http://localhost:8008 http://127.0.0.1:8008",
  "frame-src https://*.google.com https://*.live.net https://*.microsoft.com https://*.office.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ')

const securityHeadersPlugin = () => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
    )
  }
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), securityHeadersPlugin()],
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
