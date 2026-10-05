import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In production the app calls same-origin `/api/*`, served by the Vercel
// functions in client/api/. In `npm run dev` there are no Vercel functions,
// so proxy `/api` to the local Express server (server/, default port 3001).
// Override with VITE_DEV_API_PROXY if the server runs elsewhere.
const DEV_API_TARGET = process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  build: {
    // The CSS is minified for older phones too. Left to the default, the
    // minifier rewrites `@media (max-width: 640px)` as `@media (width<=640px)`,
    // which Safari before iOS 16.4 does not understand, so it skips every such
    // block: on those iPhones the phone-only layout (crop frame, touch targets,
    // desktop frame) silently never applied. These targets keep the classic
    // form every phone browser in use reads.
    cssTarget: ['safari14', 'ios14', 'chrome87', 'firefox78', 'edge88'],
  },
  server: {
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
