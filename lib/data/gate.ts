import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Password extra para entrar em Administração/Coordenação — separada do
// login normal, para um telemóvel/tablet partilhado na receção não dar
// acesso automático a essas áreas a quem lá mexer. Guardada em "config"
// (tabela global, não por estúdio) tal como as outras definições do
// negócio.
export type AreaProtegida = 'admin' | 'coordenacao'

const CHAVE_CONFIG: Record<AreaProtegida, string> = {
  admin: 'senha_admin',
  coordenacao: 'senha_coordenacao',
}

const NOME_COOKIE: Record<AreaProtegida, string> = {
  admin: 'rc_admin_ok',
  coordenacao: 'rc_coordenacao_ok',
}

const DURACAO_COOKIE = 60 * 60 * 12 // 12h — dura um turno de trabalho

export function chaveConfigSenha(area: AreaProtegida) {
  return CHAVE_CONFIG[area]
}

// Sem password definida em "config", a área fica acessível como sempre
// foi (nunca tranca por omissão) — só passa a pedir password depois de
// alguém a definir em Serviços/Produtos.
export async function areaTemPassword(supabase: SupabaseClient, area: AreaProtegida): Promise<boolean> {
  const { data } = await supabase
    .from('config')
    .select('valor')
    .eq('chave', CHAVE_CONFIG[area])
    .maybeSingle()
  return !!data?.valor
}

export async function areaDesbloqueada(area: AreaProtegida): Promise<boolean> {
  const jar = await cookies()
  return jar.get(NOME_COOKIE[area])?.value === '1'
}

export async function tentarDesbloquear(
  supabase: SupabaseClient,
  area: AreaProtegida,
  senhaSubmetida: string
): Promise<boolean> {
  const { data } = await supabase
    .from('config')
    .select('valor')
    .eq('chave', CHAVE_CONFIG[area])
    .maybeSingle()
  const senhaCorreta = data?.valor
  if (!senhaCorreta || senhaSubmetida !== senhaCorreta) {
    return false
  }
  const jar = await cookies()
  jar.set(NOME_COOKIE[area], '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURACAO_COOKIE,
    path: '/',
  })
  return true
}
