import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstadoCliente } from '@/lib/supabase/database.types'
import { SERVICO_PT } from './servicos'

// Em que serviços está um cliente: o PT (clientes.cliente_pt) e as
// inscrições nos outros (clientes_servicos), com o estado de cada um.

export type InscricaoServico = { servicoId: number; estado: EstadoCliente; inicio: string | null; saiuEm: string | null }

export async function carregarInscricoes(supabase: SupabaseClient, clienteId: string): Promise<InscricaoServico[]> {
  const { data } = await supabase
    .from('clientes_servicos')
    .select('servico_id, estado, inicio, saiu_em')
    .eq('cliente_id', clienteId)
  return (data ?? []).map((i) => ({ servicoId: i.servico_id, estado: i.estado, inicio: i.inicio, saiuEm: i.saiu_em }))
}

// Os serviços "ligados" (para as caixas do formulário): PT se é cliente
// de PT; os outros enquanto a inscrição não estiver Inativa.
export function servicosLigados(clientePt: boolean, inscricoes: InscricaoServico[]): number[] {
  return [...(clientePt ? [SERVICO_PT] : []), ...inscricoes.filter((i) => i.estado !== 'Inativo').map((i) => i.servicoId)]
}

// O que muda nas inscrições quando, no formulário, se escolhe a lista
// de serviços: os novos entram como Pendentes (até pagarem), os que
// saem ficam Inativos com a data de saída (o histórico fica), e um que
// estava Inativo e volta a ser escolhido passa a Pendente.
export function planoDeInscricoes(
  escolhidos: number[],
  atuais: InscricaoServico[],
  hoje: string
): { servicoId: number; estado: EstadoCliente; saiu_em: string | null; inicio?: string }[] {
  const mudancas: { servicoId: number; estado: EstadoCliente; saiu_em: string | null; inicio?: string }[] = []
  const outros = escolhidos.filter((id) => id !== SERVICO_PT)
  for (const id of outros) {
    const atual = atuais.find((i) => i.servicoId === id)
    if (!atual) mudancas.push({ servicoId: id, estado: 'Pendente', saiu_em: null, inicio: hoje })
    else if (atual.estado === 'Inativo') mudancas.push({ servicoId: id, estado: 'Pendente', saiu_em: null })
  }
  for (const atual of atuais) {
    if (!outros.includes(atual.servicoId) && atual.estado !== 'Inativo') {
      mudancas.push({ servicoId: atual.servicoId, estado: 'Inativo', saiu_em: hoje })
    }
  }
  return mudancas
}

export async function aplicarInscricoes(
  supabase: SupabaseClient,
  clienteId: string,
  escolhidos: number[],
  hoje: string
): Promise<string | null> {
  const atuais = await carregarInscricoes(supabase, clienteId)
  for (const m of planoDeInscricoes(escolhidos, atuais, hoje)) {
    const { error } = await supabase.from('clientes_servicos').upsert(
      {
        cliente_id: clienteId,
        servico_id: m.servicoId,
        estado: m.estado,
        saiu_em: m.saiu_em,
        ...(m.inicio ? { inicio: m.inicio } : {}),
      },
      { onConflict: 'cliente_id,servico_id' }
    )
    if (error) return error.message
  }
  return null
}

// Os serviços escolhidos num formulário (caixas "servicos"); null se o
// formulário não tinha esse campo (não se mexe em nada).
export function servicosDoFormulario(formData: FormData): number[] | null {
  if (formData.get('servicos_enviados') !== '1') return null
  return formData
    .getAll('servicos')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
}
