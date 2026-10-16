import type { TipoMovimentoStock } from "@/lib/recursos"

/** Trabalho que se pode ligar a uma saída de stock. */
export type OpcaoTrabalho = {
  id: string
  data: string
  /** "Cliente — Local". */
  descricao: string
}

/** Movimento de stock como aparece na ficha do consumível (só o gerente os vê). */
export type MovimentoLista = {
  id: string
  tipo: TipoMovimentoStock
  /** Com sinal: entradas > 0, saídas < 0, acertos qualquer sinal. */
  quantidade: number
  data: string
  precoUnitario: number | null
  notas: string | null
  /** Saída criada a partir de um material gasto num trabalho (só a BD a altera). */
  doMaterial: boolean
  trabalho: OpcaoTrabalho | null
  autor: string | null
  updatedAt: string
}
