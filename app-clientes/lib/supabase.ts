import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Liga à base de dados DA APP DO CLIENTE ("rc-clientes") com a chave
// pública. Tudo o que o cliente vê passa pelas regras (RLS) de lá: cada
// pessoa só lê as suas linhas. Não existe aqui nenhuma ligação à gestão.
export const criarSupabase = cache(async () => {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado num Server Component: o proxy trata da renovação.
        }
      },
    },
  })
})

// O "email" interno da conta (nunca é mostrado nem recebe emails): o
// cliente entra só com o nº de cliente. Tem de ser igual a
// privado.email_da_conta() na base de dados.
export function emailDaConta(numero: string): string {
  return `${numero.replace(/[^A-Za-z0-9]/g, '').toLowerCase()}@clientes.rc-app.invalid`
}

export function limparNumeroCliente(numero: string): string {
  return numero.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12)
}
