import "server-only"

import { moradaCompleta } from "@/lib/mapas"
import { eGerenteOuChefe } from "@/lib/perfis"
import type { createClient } from "@/lib/supabase/server"
import type { OpcaoLocal } from "./formulario-visita"

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Opções do formulário de visita: clientes e locais ativos e os possíveis
 * responsáveis (gerente e chefes de equipa ativos); ao editar, também os
 * que a visita já tem, mesmo que tenham sido desativados.
 */
export async function carregarOpcoesVisita(
  supabase: Supabase,
  atual?: { clienteId: string; localId: string; responsavelId: string | null }
) {
  const [clientesR, locaisR, colaboradoresR] = await Promise.all([
    supabase.from("clientes").select("id, nome, ativo").order("nome"),
    supabase
      .from("locais")
      .select("id, cliente_id, nome, morada, codigo_postal, localidade, ativo")
      .order("nome"),
    supabase.from("colaboradores").select("id, nome, perfil, ativo").order("nome"),
  ])
  if (clientesR.error) throw new Error(`Erro ao carregar os clientes: ${clientesR.error.message}`)
  if (locaisR.error) throw new Error(`Erro ao carregar os locais: ${locaisR.error.message}`)
  if (colaboradoresR.error) throw new Error(`Erro ao carregar a equipa: ${colaboradoresR.error.message}`)

  const clientes = clientesR.data
    .filter((cliente) => cliente.ativo || cliente.id === atual?.clienteId)
    .map((cliente) => ({ id: cliente.id, nome: cliente.ativo ? cliente.nome : `${cliente.nome} (inativo)` }))
  const idsClientes = new Set(clientes.map((cliente) => cliente.id))
  const locais: OpcaoLocal[] = locaisR.data
    .filter((local) => idsClientes.has(local.cliente_id) && (local.ativo || local.id === atual?.localId))
    .map((local) => ({
      id: local.id,
      clienteId: local.cliente_id,
      nome: local.nome,
      morada: moradaCompleta({
        morada: local.morada,
        codigoPostal: local.codigo_postal,
        localidade: local.localidade,
      }),
      ativo: local.ativo,
    }))
  const responsaveis = colaboradoresR.data
    .filter(
      (colaborador) =>
        (colaborador.ativo && eGerenteOuChefe(colaborador.perfil)) || colaborador.id === atual?.responsavelId
    )
    .map((colaborador) => ({
      id: colaborador.id,
      nome: colaborador.ativo ? colaborador.nome : `${colaborador.nome} (inativo)`,
    }))

  return { clientes, locais, responsaveis }
}
