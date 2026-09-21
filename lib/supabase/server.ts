import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Envolvido em cache() para que, dentro do mesmo pedido, o layout e a
// página (e quaisquer componentes entre eles) partilhem a mesma
// instância — sem isto, cada chamada isolada arriscava repetir consultas
// (ex.: "quem sou eu") que já tinham sido feitas mais acima na árvore.
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Chamado a partir de um Server Component: pode ser ignorado
            // porque o proxy (proxy.ts) já trata da renovação da sessão.
          }
        },
      },
    }
  )
})
