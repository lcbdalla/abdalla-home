import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Número único desta publicação (muda a cada build). O app compara com o
// version.json publicado para saber quando existe versão nova.
const BUILD_ID = String(Date.now())

// https://vite.dev/config/
export default defineConfig({
  // 'base' relativo garante que os assets carreguem corretamente no GitHub Pages
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'gravar-version-json',
      apply: 'build',
      closeBundle() {
        writeFileSync(resolve('dist/version.json'), JSON.stringify({ id: BUILD_ID }))
      },
    },
  ],
})
