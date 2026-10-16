import "server-only"

import type { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type Opcao = { id: string; nome: string }

/**
 * Opções da atribuição: equipas ativas e colaboradores ativos (mais os que o
 * equipamento já tem, ao editar, mesmo que entretanto desativados).
 */
export async function carregarOpcoesEquipamento(
  supabase: Supabase,
  atual?: { equipaId: string | null; colaboradorId: string | null }
): Promise<{ equipas: Opcao[]; colaboradores: Opcao[] }> {
  const [equipasR, colaboradoresR] = await Promise.all([
    supabase.from("equipas").select("id, nome, ativa").order("nome"),
    supabase.from("colaboradores").select("id, nome, ativo").order("nome"),
  ])
  if (equipasR.error) throw new Error(`Erro ao carregar as equipas: ${equipasR.error.message}`)
  if (colaboradoresR.error) throw new Error(`Erro ao carregar os colaboradores: ${colaboradoresR.error.message}`)

  return {
    equipas: equipasR.data
      .filter((equipa) => equipa.ativa || equipa.id === atual?.equipaId)
      .map((equipa) => ({ id: equipa.id, nome: equipa.ativa ? equipa.nome : `${equipa.nome} (inativa)` })),
    colaboradores: colaboradoresR.data
      .filter((colaborador) => colaborador.ativo || colaborador.id === atual?.colaboradorId)
      .map((colaborador) => ({
        id: colaborador.id,
        nome: colaborador.ativo ? colaborador.nome : `${colaborador.nome} (inativo)`,
      })),
  }
}
