import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Ligação da GESTÃO à base de dados da app do cliente (só no servidor).
// Usa a chave pública desse projeto + um token de sincronização: o
// token só dá acesso às funções sync_* de lá (nada mais), e nunca sai
// deste servidor. A app do cliente não tem nenhuma chave da gestão.

export function appClientesConfigurada(): boolean {
  return !!(process.env.APP_CLIENTES_SUPABASE_URL && process.env.APP_CLIENTES_SUPABASE_KEY && process.env.APP_CLIENTES_SYNC_TOKEN)
}

export function ligarAppClientes(): { app: SupabaseClient; token: string } {
  const url = process.env.APP_CLIENTES_SUPABASE_URL
  const chave = process.env.APP_CLIENTES_SUPABASE_KEY
  const token = process.env.APP_CLIENTES_SYNC_TOKEN
  if (!url || !chave || !token) {
    throw new Error('A app do cliente ainda não está configurada (APP_CLIENTES_SUPABASE_URL / _KEY / _SYNC_TOKEN).')
  }
  const app = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
  return { app, token }
}

export function urlAppClientes(): string {
  return (process.env.APP_CLIENTES_URL ?? 'https://rc-clientes.vercel.app').replace(/\/$/, '')
}
