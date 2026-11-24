// Service Worker mínimo: só para o app poder ser instalado no celular.
// Não guarda HTML/JS em cache (evita o app ficar preso numa versão antiga).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

// Só navegações: sem internet mostra uma página simples.
const OFFLINE_HTML = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<title>Sem conexão</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'font-family:system-ui,sans-serif;background:#12152B;color:#f4f1ea;text-align:center;padding:24px}' +
  'button{margin-top:16px;padding:12px 20px;border:0;border-radius:10px;background:#C28432;color:#12152B;font-weight:600;font-size:16px}' +
  'p{opacity:.75;margin:8px 0 0}</style></head><body><div><h1>Sem conexão</h1>' +
  '<p>Verifique a internet e tente novamente.</p><button onclick="location.reload()">Tentar novamente</button></div></body></html>';

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })),
  );
});
