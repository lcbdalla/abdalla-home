import AbdallaHome, { ConvitePage } from './AbdallaHome.jsx'

// O app do Rancho Abdalla e a tela principal. Link de convite (#convite=…) abre só a tela do convidado.
export default function App() {
  const convite = (window.location.hash.match(/convite=([A-Za-z0-9_-]+)/) || [])[1]
  return convite ? <ConvitePage token={convite} /> : <AbdallaHome />
}
