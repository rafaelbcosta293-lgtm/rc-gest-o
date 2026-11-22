import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLICAS = ['/entrar', '/ativar']

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        resposta = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options))
      },
    },
  })

  // Só decide se mostra a página ou manda entrar; a verificação a sério é
  // a RLS da base de dados (e getUser() nas páginas).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const publica = PUBLICAS.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`))
  if (!session && !publica) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
