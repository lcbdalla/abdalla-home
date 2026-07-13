import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // 'base' relativo garante que os assets carreguem corretamente no GitHub Pages
  base: './',
  plugins: [react(), tailwindcss()],
})
