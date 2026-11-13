import AbdallaHome, { ConvitePage, CamerasTecnicoPage } from './AbdallaHome.jsx'

// O app do Rancho Abdalla e a tela principal. Links sem login abrem só a sua tela:
// convite de visitante (#convite=…) e câmeras para o técnico (#cameras=…).
export default function App() {
  const convite = (window.location.hash.match(/convite=([A-Za-z0-9_-]+)/) || [])[1]
  const cameras = (window.location.hash.match(/cameras=([A-Za-z0-9_-]+)/) || [])[1]
  if (convite) return <ConvitePage token={convite} />
  if (cameras) return <CamerasTecnicoPage token={cameras} />
  return <AbdallaHome />
}
