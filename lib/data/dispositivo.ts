import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Restringe a conta partilhada de cada estúdio (EMAIL_POR_ESTUDIO, em
// lib/data/acessos.ts) a computadores já autorizados pelo dono — para a
// password do estúdio não servir para entrar fora dele (ex.: em casa de
// um instrutor). Dois estados independentes por estúdio:
//   - "ativo" (guardado em "config"): a restrição está em vigor. Sem
//     isto nunca tranca, tal como as outras áreas protegidas por
//     password desta app (ver lib/data/gate.ts) — só passa a restringir
//     depois de o dono ativar, já com os computadores do estúdio
//     autorizados.
//   - o cookie (por computador/browser, nunca guardado no servidor):
//     marca que o dono já autorizou aquele computador.
// Verificado tanto no login (app/login/actions.ts) como em todos os
// pedidos seguintes (lib/supabase/proxy.ts), para uma sessão já aberta
// também deixar de servir se o computador deixar de estar autorizado.
export const ESTUDIOS_COM_CONTA_PARTILHADA = ['fatima', 'leiria'] as const

export const NOME_COOKIE: Record<string, string> = {
  fatima: 'rc_dispositivo_fatima',
  leiria: 'rc_dispositivo_leiria',
}

const CHAVE_ATIVO: Record<string, string> = {
  fatima: 'dispositivo_fatima_ativo',
  leiria: 'dispositivo_leiria_ativo',
}

// 10 anos — pensado para nunca precisar de ser renovado neste
// computador, só quando o dono o autorizar (ou remover) de propósito.
const DURACAO_COOKIE = 60 * 60 * 24 * 365 * 10

export function chaveAtivoDispositivo(slug: string): string | undefined {
  return CHAVE_ATIVO[slug]
}

export async function restricaoAtiva(supabase: SupabaseClient, slug: string): Promise<boolean> {
  const chave = CHAVE_ATIVO[slug]
  if (!chave) return false
  const { data } = await supabase.from('config').select('valor').eq('chave', chave).maybeSingle()
  return !!data?.valor
}

export async function dispositivoAutorizado(slug: string): Promise<boolean> {
  const nome = NOME_COOKIE[slug]
  if (!nome) return true
  const jar = await cookies()
  return jar.get(nome)?.value === '1'
}

export async function autorizarEsteComputador(slug: string): Promise<void> {
  const nome = NOME_COOKIE[slug]
  if (!nome) return
  const jar = await cookies()
  jar.set(nome, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURACAO_COOKIE,
    path: '/',
  })
}

export async function removerAutorizacaoEsteComputador(slug: string): Promise<void> {
  const nome = NOME_COOKIE[slug]
  if (!nome) return
  const jar = await cookies()
  jar.delete(nome)
}

// Usado no login (app/login/actions.ts): true quando esta conta devia
// ser bloqueada neste computador.
export async function loginBloqueadoPorDispositivo(
  supabase: SupabaseClient,
  slug: string
): Promise<boolean> {
  if (!(await restricaoAtiva(supabase, slug))) return false
  return !(await dispositivoAutorizado(slug))
}
