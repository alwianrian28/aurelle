import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Staff dashboard. Same-origin API in development: Vite forwards /api to FastAPI.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:8000', changeOrigin: false } },
  },
})
