// Aulas virtuais: a biblioteca de aulas em vídeo (YouTube não listado)
// que os clientes com o serviço "Aulas Virtuais" veem na app do cliente.
// Gerida na Coordenação (app/painel/coordenacao/aulas-virtuais).

export const CHAVE_SERVICO_VIRTUAIS = 'virtuais'

export const NIVEIS_AULA_VIRTUAL = ['Iniciação', 'Intermédio', 'Avançado'] as const
export type NivelAulaVirtual = (typeof NIVEIS_AULA_VIRTUAL)[number]

// Sugestões de categoria (pode escrever-se outra).
export const CATEGORIAS_SUGERIDAS = ['Pilates', 'Mobilidade', 'Força', 'Cardio', 'Alongamentos', 'Core', 'Relaxamento']

export type AulaVirtual = {
  id: string
  titulo: string
  descricao: string | null
  categoria: string
  nivel: NivelAulaVirtual | null
  duracao_min: number | null
  youtube_id: string
  publicada: boolean
  ordem: number
  criado_em: string
}

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/

// O código do vídeo (11 caracteres) a partir do que a pessoa colou: a
// ligação normal (youtube.com/watch?v=…), a curta (youtu.be/…), a de
// partilha com parâmetros, /embed/, /shorts/, /live/ — ou só o código.
// null se não for uma ligação do YouTube.
export function extrairIdYoutube(texto: string | null | undefined): string | null {
  const t = (texto ?? '').trim()
  if (!t) return null
  if (ID_YOUTUBE.test(t)) return t
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  const dominio = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '')
  let id: string | null = null
  if (dominio === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (dominio === 'youtube.com' || dominio === 'youtube-nocookie.com') {
    const partes = url.pathname.split('/').filter(Boolean)
    if (partes[0] === 'watch') id = url.searchParams.get('v')
    else if (['embed', 'shorts', 'live', 'v'].includes(partes[0] ?? '')) id = partes[1] ?? null
  }
  return id && ID_YOUTUBE.test(id) ? id : null
}

export const ligacaoYoutube = (id: string) => `https://youtu.be/${id}`

// A imagem de capa do vídeo (320×180), servida pelo YouTube.
export const miniaturaYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

// "45 min" · "1 h" · "1 h 15"
export function duracaoPorExtenso(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

// As aulas pela ordem em que aparecem (a ordem escolhida; em caso de
// empate, as mais antigas primeiro), agrupadas por categoria — as
// categorias pela ordem da sua primeira aula.
export function agruparPorCategoria<T extends { categoria: string; ordem: number; criado_em?: string; id: string }>(
  aulas: T[]
): { categoria: string; aulas: T[] }[] {
  const ordenadas = [...aulas].sort(
    (a, b) => a.ordem - b.ordem || (a.criado_em ?? '').localeCompare(b.criado_em ?? '') || a.id.localeCompare(b.id)
  )
  const grupos: { categoria: string; aulas: T[] }[] = []
  for (const a of ordenadas) {
    const g = grupos.find((x) => x.categoria === a.categoria)
    if (g) g.aulas.push(a)
    else grupos.push({ categoria: a.categoria, aulas: [a] })
  }
  return grupos
}

// O que segue para a app do cliente: só as publicadas, sem dados internos.
export type AulaVirtualApp = {
  id: string
  titulo: string
  descricao: string | null
  categoria: string
  nivel: string | null
  duracao_min: number | null
  youtube_id: string
  ordem: number
}

export function montarAulasVirtuaisApp(aulas: AulaVirtual[]): AulaVirtualApp[] {
  return agruparPorCategoria(aulas.filter((a) => a.publicada))
    .flatMap((g) => g.aulas)
    .map((a, i) => ({
      id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      categoria: a.categoria,
      nivel: a.nivel,
      duracao_min: a.duracao_min,
      youtube_id: a.youtube_id,
      // Ordem final (1, 2, 3…), já com as categorias juntas.
      ordem: i + 1,
    }))
}
