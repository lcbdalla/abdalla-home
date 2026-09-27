import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Aplica o tema salvo (modo noturno) antes de renderizar, para não piscar branco.
try {
  const t = localStorage.getItem('tema')
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
} catch { /* sem storage: fica no tema claro */ }

// Registra o service worker (necessário para "Instalar app"); só no site publicado.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
