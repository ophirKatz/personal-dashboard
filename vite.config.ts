import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Dev-only stand-in for api/runescape.ts (Vite doesn't serve /api): reuses the real handler.
function runescapeDevApi(): Plugin {
  return {
    name: 'runescape-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/runescape', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/runescape.ts')
        const query = Object.fromEntries(new URL(req.url ?? '', 'http://x').searchParams)
        const out = {
          status(code: number) { res.statusCode = code; return out },
          setHeader(k: string, v: string) { res.setHeader(k, v) },
          json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) },
        }
        await handler({ query }, out)
      })
    },
  }
}

export default defineConfig({
  server: {
    // Vite doesn't serve /api (Vercel functions); mirror the book-search proxy for local dev.
    proxy: {
      '/api/book-search': {
        target: 'https://openlibrary.org',
        changeOrigin: true,
        rewrite: path => {
          const q = new URL(path, 'http://x').searchParams.get('q') ?? ''
          return `/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,author_name,first_publish_year,cover_i`
        },
      },
    },
  },
  plugins: [
    react(),
    runescapeDevApi(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Personal Dashboard',
        short_name: 'Dashboard',
        description: 'Track todos, habits, and climbing sessions.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
})
