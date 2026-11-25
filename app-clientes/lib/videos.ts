import type { AulaVirtual } from './dados'

// A imagem de capa do vídeo (320×180), servida pelo YouTube.
export const capaDoVideo = (youtubeId: string) => `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`

// O endereço para tocar o vídeo dentro da app (sem sugestões de outros
// canais no fim, e a tocar no próprio ecrã no iPhone).
export const leitorDoVideo = (youtubeId: string) =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`

// "45 min" · "1 h" · "1 h 15"
export function duracaoPorExtenso(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

// "Iniciação · 20 min" (o que houver).
export function resumoDaAula(a: Pick<AulaVirtual, 'nivel' | 'duracao_min'>): string {
  return [a.nivel, duracaoPorExtenso(a.duracao_min)].filter(Boolean).join(' · ')
}

// As aulas agrupadas por categoria, pela ordem em que vêm (já ordenadas).
export function porCategoria<T extends { categoria: string }>(aulas: T[]): { categoria: string; aulas: T[] }[] {
  const grupos: { categoria: string; aulas: T[] }[] = []
  for (const a of aulas) {
    const g = grupos.find((x) => x.categoria === a.categoria)
    if (g) g.aulas.push(a)
    else grupos.push({ categoria: a.categoria, aulas: [a] })
  }
  return grupos
}

// Âncora de uma categoria na página ("Força e core" → "forca-e-core").
export function ancora(categoria: string): string {
  return (
    categoria
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'aulas'
  )
}
