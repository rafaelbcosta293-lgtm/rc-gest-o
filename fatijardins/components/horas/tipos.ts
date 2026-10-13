import type { EstadoTrabalho } from "@/lib/trabalhos"

/** Trabalho de hoje que se pode escolher ao picar. */
export type TrabalhoPicagem = {
  id: string
  titulo: string
  cliente: string | null
  /** Hora prevista ("08:30") ou null. */
  hora: string | null
  equipa: string | null
  estado: EstadoTrabalho
}

/** Período em aberto (entrada sem saída) da pessoa. */
export type PeriodoAberto = {
  id: string
  /** Instante da entrada (ISO). */
  entrada: string
  trabalhoId: string | null
  /** Título do trabalho (null sem trabalho ou se já não estiver visível). */
  trabalho: string | null
  cliente: string | null
}

/** Tudo o que o widget de picagem precisa, lido no servidor. */
export type EstadoPicagem = {
  aberto: PeriodoAberto | null
  /** Hoje em Lisboa (aaaa-mm-dd), calculado no servidor. */
  hoje: string
  /** Hora do servidor (ms) para o primeiro desenho do contador. */
  agora: number
  /** Minutos dos períodos de hoje já fechados. */
  minutosFechadosHoje: number
  /** Hora ("12:40") da última saída de hoje, quando não há entrada aberta. */
  ultimaSaida: string | null
  trabalhos: TrabalhoPicagem[]
}
