import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Estudio, Perfil } from '@/lib/supabase/database.types'
import { idsContasPartilhadas } from './contasPartilhadas'
import { chaveDaSessao, criarMemoria } from './memoria'

// Os estúdios quase nunca mudam, mas todas as páginas precisam deles
// antes de mais nada ("que estúdio é este slug?") — era uma ida à base
// de dados sozinha, à frente de todas as outras, em cada página aberta.
// Ficam 5 minutos na memória do servidor, por sessão (ver
// lib/data/memoria.ts): cada conta continua a ver só os estúdios que a
// base de dados lhe mostrou a ela. Dentro do mesmo pedido, cache()
// garante que o layout e a página partilham a mesma resposta.
const VALIDADE_ESTUDIOS_MS = 5 * 60_000
const memoriaEstudios = criarMemoria<Estudio[]>(VALIDADE_ESTUDIOS_MS)

export const getEstudios = cache(async (supabase: SupabaseClient): Promise<Estudio[]> => {
  const chave = await chaveDaSessao(supabase)
  try {
    return await memoriaEstudios.obter(
      chave,
      async () => {
        const { data, error } = await supabase.from('estudios').select('*').eq('ativo', true).order('nome')
        // Uma falha nunca fica guardada: volta a tentar no pedido seguinte.
        if (error) throw new Error(error.message)
        return (data as Estudio[] | null) ?? []
      },
      (estudios) => estudios.length > 0
    )
  } catch {
    return []
  }
})

// Usado pelas pastas "filtráveis" da Administração (submenu "só
// Fátima/só Leiria" no menu superior) — sem slug, ou com um slug que
// não bate certo com nenhum estúdio, mostra-os a todos como sempre.
export function filtrarPorEstudio<T extends { slug: string }>(estudios: T[], slug: string | undefined): T[] {
  if (!slug) return estudios
  const filtrado = estudios.filter((e) => e.slug === slug)
  return filtrado.length > 0 ? filtrado : estudios
}

// Sai da mesma lista (em memória) — sem consulta própria.
export const getEstudioPorSlug = cache(async (supabase: SupabaseClient, slug: string): Promise<Estudio | null> => {
  const estudios = await getEstudios(supabase)
  return estudios.find((e) => e.slug === slug) ?? null
})

// Só quem o admin autorizou (em "Equipa") aparece para escolher como PT
// dentro deste estúdio — em vez de toda a gente registada na app. As
// contas partilhadas (Coordenação, RC Fátima, RC Leiria) ficam de fora:
// não são instrutores. "manter" é o id que um registo antigo já tem
// escolhido — esse continua na lista, para editar o registo não lhe
// trocar o instrutor sem ninguém dar por isso.
export async function getEquipaDoEstudio(
  supabase: SupabaseClient,
  estudioId: number,
  manter?: string | null
): Promise<Pick<Perfil, 'id' | 'nome'>[]> {
  const [{ data, error }, partilhadas] = await Promise.all([
    supabase.from('perfis_estudios').select('perfil:perfis!perfil_id(id, nome)').eq('estudio_id', estudioId),
    idsContasPartilhadas(),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const pessoas = (data ?? [])
    .map((d) => d.perfil as unknown as Pick<Perfil, 'id' | 'nome'> | null)
    .filter((p): p is Pick<Perfil, 'id' | 'nome'> => p !== null && (!partilhadas.has(p.id) || p.id === manter))

  return pessoas.sort((a, b) => a.nome.localeCompare(b.nome))
}

export type ClienteOutroEstudio = { id: string; nome: string }

// Para a Agenda conseguir agendar um cliente de Fátima num evento de
// Leiria (ou vice-versa) sem misturar o resto dos dados dos dois
// estúdios: quem só tem acesso a um dos dois (ex.: conta "RC Leiria")
// não consegue, por RLS, ler a lista de clientes do outro — por isso
// usa-se aqui o cliente de administração (ignora RLS) só para esta
// lista de nomes a escolher, nunca para mais nada. Só faz sentido
// havendo exatamente dois estúdios ativos; com mais do que isso não há
// um "outro" óbvio, por isso a opção fica simplesmente escondida.
export async function obterOutroEstudioEClientes(
  supabase: SupabaseClient,
  estudioAtualId: number
): Promise<{ outroEstudio: Pick<Estudio, 'id' | 'nome'> | null; clientesOutroEstudio: ClienteOutroEstudio[] }> {
  const estudios = await getEstudios(supabase)
  if (estudios.length !== 2) {
    return { outroEstudio: null, clientesOutroEstudio: [] }
  }
  const outro = estudios.find((e) => e.id !== estudioAtualId)
  if (!outro) {
    return { outroEstudio: null, clientesOutroEstudio: [] }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clientes')
    .select('id, nome')
    .eq('estudio_id', outro.id)
    .order('nome')
  if (error) {
    throw new Error(error.message)
  }

  return {
    outroEstudio: { id: outro.id, nome: outro.nome },
    clientesOutroEstudio: (data ?? []) as ClienteOutroEstudio[],
  }
}
