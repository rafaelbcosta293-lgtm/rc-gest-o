import type { AulaVirtual } from './dados'

// A imagem de capa de uma aula, servida pela própria app (o endereço não
// mostra qual é o vídeo no YouTube). "grande" é a do leitor.
export const capaDoVideo = (aulaId: string, grande = false) => `/videos/${aulaId}/capa${grande ? '?grande' : ''}`

// O endereço do vídeo dentro do nosso leitor: sem os botões nem o teclado
// do YouTube (os botões são os nossos), sem sugestões de outros canais no
// fim, e a tocar no próprio ecrã no iPhone. "origem" é o endereço desta
// app, que o YouTube exige para aceitar os nossos comandos.
export function enderecoDoLeitor(youtubeId: string, origem: string): string {
  const p = new URLSearchParams({
    enablejsapi: '1',
    origin: origem,
    controls: '0',
    disablekb: '1',
    fs: '0',
    rel: '0',
    playsinline: '1',
    iv_load_policy: '3',
  })
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${p}`
}

// O relógio do leitor: "0:07" · "12:30" · "1:02:05".
export function relogioDoVideo(segundos: number): string {
  const t = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(t % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

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
