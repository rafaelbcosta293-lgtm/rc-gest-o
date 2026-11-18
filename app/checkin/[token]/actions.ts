'use server'

import { createClient } from '@supabase/supabase-js'
import { lerResultado, limparNumero, type ResultadoCheckin } from '@/lib/data/checkin'

// Sem sessão nenhuma (chave pública): esta página corre num tablet a que
// os clientes têm acesso, por isso não pode usar a conta da equipa. A
// única coisa que a chave pública pode fazer aqui é chamar
// registar_checkin(), que valida o link do tablet e nunca devolve dados
// de clientes.
export async function registarPresenca(token: string, numero: string): Promise<ResultadoCheckin> {
  const digitos = limparNumero(numero)
  if (!digitos || !/^[a-f0-9]{16,128}$/i.test(token)) return { estado: 'recusado' }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.rpc('registar_checkin', { p_token: token, p_numero: digitos })
  if (error) {
    console.error('[checkin]', error.message)
    return { estado: 'erro' }
  }
  return lerResultado(data)
}
