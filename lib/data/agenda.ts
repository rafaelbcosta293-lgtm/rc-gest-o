import { somarDias } from '@/lib/data/horarios'
import { PALETA } from '@/lib/data/constantes'
import type { TipoEventoAgenda } from '@/lib/supabase/database.types'

export const TIPOS_EVENTO_AGENDA: TipoEventoAgenda[] = ['Treino', 'Avaliação', 'Reunião', 'Outro']

const COR_TIPO_EVENTO: Record<TipoEventoAgenda, keyof typeof PALETA> = {
  Treino: 'teal',
  Avaliação: 'azul',
  Reunião: 'roxo',
  Outro: 'neutro',
}

export function corTipoEvento(tipo: TipoEventoAgenda) {
  return PALETA[COR_TIPO_EVENTO[tipo]]
}

export type Repeticao = 'nao' | 'semanal' | 'quinzenal'
export type LimiteRepeticao = { modo: 'ate'; ate: string } | { modo: 'vezes'; vezes: number }

// Nunca gera mais do que isto numa só criação — evita que um "até" muito
// distante no futuro, por engano, crie centenas de linhas de uma vez.
const MAX_OCORRENCIAS = 52

// Expande "repete toda a semana/quinzena até Y" ou "N vezes" numa lista
// de datas. Cada data vira depois uma linha própria em agenda_eventos,
// ligada por serie_id — por isso só é preciso calcular isto uma vez, ao
// criar o evento, nunca ao mostrar a agenda.
export function gerarOcorrencias(
  dataInicial: string,
  repeticao: Repeticao,
  limite: LimiteRepeticao
): string[] {
  if (repeticao === 'nao') return [dataInicial]

  const passo = repeticao === 'semanal' ? 7 : 14
  const datas: string[] = []
  let cursor = dataInicial

  if (limite.modo === 'vezes') {
    const total = Math.max(1, Math.min(limite.vezes, MAX_OCORRENCIAS))
    for (let i = 0; i < total; i++) {
      datas.push(cursor)
      cursor = somarDias(cursor, passo)
    }
    return datas
  }

  while (cursor <= limite.ate && datas.length < MAX_OCORRENCIAS) {
    datas.push(cursor)
    cursor = somarDias(cursor, passo)
  }
  return datas
}
