import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Aplica o tema salvo (modo noturno) antes de renderizar, para não piscar branco.
try {
  const t = localStorage.getItem('tema')
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
  if (t === 'dark') document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0e1a12')
} catch { /* sem storage: fica no tema claro */ }

// Toque em qualquer botão: vibração curtinha (Android; o iPhone não permite vibrar pelo navegador).
document.addEventListener('click', (e) => {
  const b = e.target instanceof Element && e.target.closest('button, [role="button"], a[href], input[type="checkbox"], label')
  if (b && !b.disabled) { try { navigator.vibrate?.(10) } catch { /* sem vibração */ } }
}, true)

// Tela "estreita" (celular com zoom de tela ou fonte grande): o app é montado como se tivesse 360 px
// de largura e reduzido para caber, em vez de apertar e quebrar os cartões.
// ponytail: CSS zoom no #root; arrastar cartões com zoom < 1 pode desalinhar um pouco o cartão na mão.
const LARGURA_MIN = 360
const caber = () => { const r = document.getElementById('root'); if (r) r.style.zoom = window.innerWidth < LARGURA_MIN ? String(window.innerWidth / LARGURA_MIN) : '' }
caber()
window.addEventListener('resize', caber)

// Registra o service worker (necessário para "Instalar app"); só no site publicado.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
