import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Content-Security-Policy applied to production builds only
// (the dev server needs inline scripts for React Fast Refresh).
//
// frame-ancestors is included below, but a meta-tag CSP ignores it.
// public/frame-buster.js is the enforcement that works on GitHub Pages.
//
// Later FamilySearch hosts, not used yet, so they stay commented out:
//   https://ident.familysearch.org
//   https://api.familysearch.org
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com https://js.live.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://fal.media https://v3.fal.media https://v3b.fal.media https://*.fal.media",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  [
    "connect-src 'self' blob: data:",
    "http://localhost:8008 http://127.0.0.1:8008",
    "https://rest.fal.ai https://rest.alpha.fal.ai https://fal.run https://queue.fal.run",
    "https://fal.media https://v3.fal.media https://v3b.fal.media https://*.fal.media https://storage.fal.ai",
    "https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com",
    "https://graph.microsoft.com https://login.microsoftonline.com https://login.live.com https://api.onedrive.com https://*.files.1drv.com"
  ].join(' '),
  "frame-src https://accounts.google.com https://apis.google.com https://docs.google.com https://drive.google.com https://login.microsoftonline.com https://login.live.com https://onedrive.live.com https://js.live.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
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
