import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In production the app calls same-origin `/api/*`, served by the Vercel
// functions in client/api/. In `npm run dev` there are no Vercel functions,
// so proxy `/api` to the local Express server (server/, default port 3001).
// Override with VITE_DEV_API_PROXY if the server runs elsewhere.
const DEV_API_TARGET = process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
