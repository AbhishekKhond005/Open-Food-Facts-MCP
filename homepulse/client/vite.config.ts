import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.SIMULATOR_BACKEND_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
