import "server-only"

import { carregarOpcoesTrabalho } from "@/app/(app)/trabalhos/_componentes/dados-formulario"
import type { Sessao } from "@/lib/auth"
import { diaDaSemana, feriadoNacional, somarDiasData } from "@/lib/datas"
import { formatarArea } from "@/lib/formatar"
import type { createClient } from "@/lib/supabase/server"
import type { VisitaOrigem } from "./formulario-orcamento"

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Opções do formulário do orçamento: clientes e locais ativos (mais o local
 * atual), as equipas (para converter em trabalho) e o que a empresa propõe
 * para os orçamentos novos (validade e condições).
 */
export async function carregarOpcoesOrcamento(
  supabase: Supabase,
  sessao: Sessao,
  atual?: { clienteId: string; localId: string }
) {
  const [opcoes, empresaR] = await Promise.all([
    carregarOpcoesTrabalho(supabase, sessao, atual && { ...atual, equipaId: null }),
    supabase.from("empresa").select("validade_orcamento_dias, condicoes_orcamento").maybeSingle(),
  ])
  if (empresaR.error) throw new Error(`Erro ao carregar os dados da empresa: ${empresaR.error.message}`)
  return {
    clientes: opcoes.clientes,
    locais: opcoes.locais,
    equipas: opcoes.equipas,
    validadeDias: empresaR.data?.validade_orcamento_dias ?? 30,
    condicoes: empresaR.data?.condicoes_orcamento ?? "",
  }
}

/** Visita de origem para o formulário (com o texto que pode copiar para a descrição). */
export function visitaOrigem(visita: {
  id: string
  data: string
  local_id: string
  medidas: string | null
  area_m2: number | null
  notas: string | null
}): VisitaOrigem {
  const partes = [
    visita.medidas?.trim() && `Medidas:\n${visita.medidas.trim()}`,
    visita.area_m2 && `Área total: ${formatarArea(visita.area_m2)}`,
    visita.notas?.trim(),
  ].filter(Boolean)
  return { id: visita.id, data: visita.data, localId: visita.local_id, resumo: partes.length ? partes.join("\n\n") : null }
}

/** Próximo dia útil depois de hoje (sem fins de semana nem feriados nacionais). */
export function proximoDiaUtil(hoje: string): string {
  let dia = somarDiasData(hoje, 1)
  while (diaDaSemana(dia) >= 6 || feriadoNacional(dia)) dia = somarDiasData(dia, 1)
  return dia
}
