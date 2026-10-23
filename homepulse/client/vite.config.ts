import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Optional: proxy API requests to the backend in dev, so you don't need CORS headers
      // '/api': 'http://localhost:3000',
    },
  },
})
