/*
 * Service worker da Fatijardins (registado em produção por
 * components/registar-service-worker.tsx).
 *
 * - Páginas: sempre da rede. Sem rede, mostra a página /offline guardada.
 * - Ficheiros estáticos com hash (/_next/static/) e ícones (/icons/):
 *   cache primeiro, porque nunca mudam.
 * - NUNCA guarda páginas com dados (HTML com sessão), respostas RSC,
 *   pedidos a outros domínios (ex.: Supabase) nem pedidos que não sejam GET.
 *
 * Para obrigar todos os telemóveis a renovar a cache (ex.: mudou o aspeto
 * da página /offline), aumente VERSAO.
 */

const VERSAO = "v1"
const CACHE_BASE = `fatijardins-base-${VERSAO}`
const CACHE_ESTATICOS = `fatijardins-estaticos-${VERSAO}`
const MAXIMO_ESTATICOS = 150

const PAGINA_OFFLINE = "/offline"
const ICONES = [
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_BASE)
      await cache.addAll(ICONES.map((url) => new Request(url, { cache: "reload" })))

      // Pedida sem cookies: a página /offline é pública e não tem dados.
      const resposta = await fetch(
        new Request(PAGINA_OFFLINE, { cache: "reload", credentials: "omit" })
      )
      if (!resposta.ok || resposta.redirected) {
        throw new Error(`Não foi possível guardar ${PAGINA_OFFLINE} (${resposta.status}).`)
      }
      await cache.put(PAGINA_OFFLINE, resposta.clone())
      await guardarRecursosDaPagina(cache, await resposta.text())

      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const atuais = [CACHE_BASE, CACHE_ESTATICOS]
      const nomes = await caches.keys()
      await Promise.all(
        nomes.filter((nome) => !atuais.includes(nome)).map((nome) => caches.delete(nome))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const pedido = event.request
  if (pedido.method !== "GET") return

  const url = new URL(pedido.url)
  // Outros domínios (Supabase, mapas…): o browser trata, sem cache.
  if (url.origin !== self.location.origin) return
  if (ePedidoRsc(pedido, url)) return

  if (pedido.mode === "navigate") {
    event.respondWith(paginaDaRede(pedido))
    return
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cachePrimeiro(event, pedido))
  }
})

/** Pedidos de dados do Next.js (React Server Components). */
function ePedidoRsc(pedido, url) {
  return (
    url.searchParams.has("_rsc") ||
    pedido.headers.has("RSC") ||
    pedido.headers.has("Next-Router-State-Tree")
  )
}

/** Rede primeiro; sem rede devolve a página /offline (a resposta da rede nunca é guardada). */
async function paginaDaRede(pedido) {
  try {
    return await fetch(pedido)
  } catch {
    const offline = await caches.match(PAGINA_OFFLINE, { cacheName: CACHE_BASE })
    return (
      offline ??
      new Response("Sem ligação à internet. Tente de novo quando tiver rede.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    )
  }
}

async function cachePrimeiro(event, pedido) {
  const guardada = await caches.match(pedido)
  if (guardada) return guardada

  const resposta = await fetch(pedido)
  if (resposta.status === 200 && resposta.type === "basic") {
    const copia = resposta.clone()
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_ESTATICOS)
        await cache.put(pedido, copia)
        await limitarCache(cache, MAXIMO_ESTATICOS)
      })()
    )
  }
  return resposta
}

/** Guarda o CSS, JS e tipos de letra referidos no HTML da página /offline. */
async function guardarRecursosDaPagina(cache, html) {
  const encontrados = html.match(/\/_next\/static\/[^"'\s<>()\\]+/g) ?? []
  const urls = [...new Set(encontrados.map((url) => url.replaceAll("&amp;", "&")))]
  // Um recurso que falhe não impede a instalação.
  await Promise.allSettled(urls.map((url) => cache.add(url)))
}

/** Apaga as entradas mais antigas quando a cache passa do máximo. */
async function limitarCache(cache, maximo) {
  const chaves = await cache.keys()
  const aApagar = chaves.slice(0, Math.max(0, chaves.length - maximo))
  await Promise.all(aApagar.map((chave) => cache.delete(chave)))
}
