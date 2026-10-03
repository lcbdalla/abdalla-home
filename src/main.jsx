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

// Registra o service worker (necessário para "Instalar app"); só no site publicado.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
