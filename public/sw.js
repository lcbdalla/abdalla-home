// Service worker mínimo: só existe para o navegador oferecer "Instalar app".
// Não guarda nada em cache, então o app sempre carrega a versão mais nova.
// ponytail: sem modo offline; adicionar cache aqui se precisar abrir sem internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
