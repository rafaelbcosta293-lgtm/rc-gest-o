import { somarDias } from '@/lib/data/horarios'
import { PALETA } from '@/lib/data/constantes'
import type { RepeticaoSerieAgenda, TipoEventoAgenda } from '@/lib/supabase/database.types'

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
export type LimiteRepeticao =
  | { modo: 'ate'; ate: string }
  | { modo: 'vezes'; vezes: number }
  // "Até eu interromper" — nunca se gera "para sempre" de uma vez: cria-se
  // só a janela inicial (até HORIZONTE_INDEFINIDO_DIAS) e o cron diário
  // (/api/cron/agenda-series) vai estendendo essa janela, sempre com o
  // mesmo horizonte à frente, enquanto a série em agenda_series continuar
  // "ativa" — ver gerarExtensaoSerie.
  | { modo: 'indefinido' }

// Nunca gera mais do que isto numa só vez — evita que um "até" muito
// distante no futuro, por engano, crie centenas de linhas de uma vez.
const MAX_OCORRENCIAS = 52

// Janela de ocorrências já criadas à frente, para uma série indefinida —
// dá folga suficiente para a pessoa ver e gerir as próximas marcações
// sem o cron ter de correr a cada pedido.
const HORIZONTE_INDEFINIDO_DIAS = 90

// Expande "repete toda a semana/quinzena até Y", "N vezes" ou
// "indefinidamente" numa lista de datas. Cada data vira depois uma linha
// própria em agenda_eventos, ligada por serie_id — por isso só é preciso
// calcular isto uma vez, ao criar o evento, nunca ao mostrar a agenda.
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

  const ateData = limite.modo === 'ate' ? limite.ate : somarDias(dataInicial, HORIZONTE_INDEFINIDO_DIAS)
  while (cursor <= ateData && datas.length < MAX_OCORRENCIAS) {
    datas.push(cursor)
    cursor = somarDias(cursor, passo)
  }
  return datas
}

// Só para o cron: dada a última data já gerada de uma série indefinida
// ainda ativa, devolve as datas novas precisas para a janela voltar a
// chegar ao horizonte de hoje — lista vazia quando já lá está (nada a
// fazer nessa série, nesse dia).
export function gerarExtensaoSerie(
  ultimaDataGerada: string,
  repeticao: RepeticaoSerieAgenda,
  hoje: string
): string[] {
  const passo = repeticao === 'semanal' ? 7 : 14
  const ateData = somarDias(hoje, HORIZONTE_INDEFINIDO_DIAS)
  const datas: string[] = []
  let cursor = somarDias(ultimaDataGerada, passo)
  while (cursor <= ateData && datas.length < MAX_OCORRENCIAS) {
    datas.push(cursor)
    cursor = somarDias(cursor, passo)
  }
  return datas
}
