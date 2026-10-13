import "server-only"

import type { Sessao } from "@/lib/auth"
import { moradaCompleta } from "@/lib/mapas"
import { eGerente } from "@/lib/perfis"
import type { createClient } from "@/lib/supabase/server"
import type { OpcaoLocal } from "./formulario-trabalho"

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Opções do formulário de trabalho: clientes e locais ativos (mais o local
 * atual, ao editar) e as equipas em que o utilizador pode agendar.
 */
export async function carregarOpcoesTrabalho(
  supabase: Supabase,
  sessao: Sessao,
  atual?: { clienteId: string; localId: string; equipaId: string | null }
) {
  const [clientesR, locaisR, equipasR] = await Promise.all([
    supabase.from("clientes").select("id, nome, ativo").order("nome"),
    supabase
      .from("locais")
      .select("id, cliente_id, nome, morada, codigo_postal, localidade, ativo")
      .order("nome"),
    supabase.from("equipas").select("id, nome, ativa, chefe_id").order("nome"),
  ])
  if (clientesR.error) throw new Error(`Erro ao carregar os clientes: ${clientesR.error.message}`)
  if (locaisR.error) throw new Error(`Erro ao carregar os locais: ${locaisR.error.message}`)
  if (equipasR.error) throw new Error(`Erro ao carregar as equipas: ${equipasR.error.message}`)

  const gerente = eGerente(sessao.colaborador.perfil)
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
  // O gerente agenda em qualquer equipa ativa; o chefe só nas que chefia.
  const equipas = equipasR.data
    .filter(
      (equipa) =>
        (equipa.ativa && (gerente || equipa.chefe_id === sessao.colaborador.id)) || equipa.id === atual?.equipaId
    )
    .map((equipa) => ({ id: equipa.id, nome: equipa.ativa ? equipa.nome : `${equipa.nome} (inativa)` }))

  return { clientes, locais, equipas, permitirSemEquipa: gerente }
}
