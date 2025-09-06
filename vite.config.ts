import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: "./", // penting biar CSS/JS bisa load di Vercel
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'), // biar `@/components/...` jalan
    },
  },
})
