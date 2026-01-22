import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  plugins: [react(), tailwindcss(),viteSingleFile()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        ws: true,
      },
    },
  },
  build: {
    assetsInlineLimit: 10000000
  }
})
