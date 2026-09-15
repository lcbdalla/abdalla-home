// Service worker do Abdalla Home.
// - Libera o "Instalar app" (PWA).
// - Recebe os lembretes de tarefa (web push) e mostra a notificação, mesmo com o app fechado.
// Não guarda cache: o app sempre carrega a versão mais nova.
// ponytail: sem modo offline; adicionar cache aqui se precisar abrir sem internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const titulo = d.titulo || "Abdalla Home";
  const opcoes = {
    body: d.corpo || "Você tem uma tarefa em breve.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: d.tag || "lembrete",
    data: { url: d.url || "./" },
  };
  e.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) { if ("focus" in j) return j.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(alvo);
    })
  );
});
