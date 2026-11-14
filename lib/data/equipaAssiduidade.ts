import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { ehContaFixa } from './acessos'
import { HORAS_DIARIAS_OMISSAO } from './assiduidade'

export type ConfigAssiduidade = {
  perfil_id: string
  estudio_id: number
  horas_diarias: number
  tipo_contrato: 'contrato' | 'recibos_verdes'
}

export type MembroEquipa = { id: string; nome: string; config: ConfigAssiduidade }

export const TIPOS_CONTRATO: Record<ConfigAssiduidade['tipo_contrato'], string> = {
  contrato: 'Contrato de trabalho',
  recibos_verdes: 'Recibos verdes',
}

export const CHAVE_LIMITE_FERIAS = 'ferias_max_pts_simultaneo'

// As 4 contas fixas do negócio (dono, geral, Fátima, Leiria) também têm
// ficha em "perfis", mas não são instrutores — ficam fora de férias e
// horários. Só se sabe quem são pelo email, que vive no Auth.
const idsContasFixas = cache(async (): Promise<Set<string>> => {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  return new Set(data.users.filter((u) => ehContaFixa(u.email ?? null)).map((u) => u.id))
})

function configPorOmissao(perfilId: string, estudioId: number): ConfigAssiduidade {
  return { perfil_id: perfilId, estudio_id: estudioId, horas_diarias: HORAS_DIARIAS_OMISSAO, tipo_contrato: 'contrato' }
}

// Instrutores ativos de um estúdio, com a sua configuração (ou a de
// omissão: 8h/dia, contrato, este estúdio).
export async function equipaAssiduidade(supabase: SupabaseClient, estudioId: number): Promise<MembroEquipa[]> {
  const [{ data: ligacoes, error }, fixas] = await Promise.all([
    supabase.from('perfis_estudios').select('perfil:perfis!perfil_id(id, nome, ativo)').eq('estudio_id', estudioId),
    idsContasFixas(),
  ])
  if (error) throw new Error(error.message)
  const pessoas = (ligacoes ?? [])
    .map((l) => l.perfil as unknown as { id: string; nome: string; ativo: boolean } | null)
    .filter((p): p is { id: string; nome: string; ativo: boolean } => !!p && p.ativo && !fixas.has(p.id))
  if (pessoas.length === 0) return []
  const { data: configs, error: erroConfig } = await supabase
    .from('config_assiduidade')
    .select('perfil_id, estudio_id, horas_diarias, tipo_contrato')
    .in('perfil_id', pessoas.map((p) => p.id))
  if (erroConfig) throw new Error(erroConfig.message)
  const porPerfil = new Map((configs ?? []).map((c) => [c.perfil_id, { ...c, horas_diarias: Number(c.horas_diarias) }]))
  return pessoas
    .map((p) => ({ id: p.id, nome: p.nome.trim(), config: porPerfil.get(p.id) ?? configPorOmissao(p.id, estudioId) }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function configDoPerfil(
  supabase: SupabaseClient,
  perfilId: string,
  estudioIdOmissao: number
): Promise<ConfigAssiduidade> {
  const { data } = await supabase
    .from('config_assiduidade')
    .select('perfil_id, estudio_id, horas_diarias, tipo_contrato')
    .eq('perfil_id', perfilId)
    .maybeSingle()
  return data ? { ...data, horas_diarias: Number(data.horas_diarias) } : configPorOmissao(perfilId, estudioIdOmissao)
}

export async function limiteFeriasSimultaneo(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase.from('config').select('valor').eq('chave', CHAVE_LIMITE_FERIAS).maybeSingle()
  const n = Number(data?.valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Quem pode registar horários e pedir férias: uma conta pessoal de um
// instrutor (as contas partilhadas não identificam a pessoa).
export function podeUsarComoInstrutor(sessao: { userId: string | null; email: string | null }): boolean {
  return !!sessao.userId && !ehContaFixa(sessao.email)
}
