import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Páginas que qualquer visitante pode ver sem ter sessão iniciada.
// Tudo o resto (ex.: /painel) exige login.
const PUBLIC_PATHS = ['/', '/login', '/registo', '/recuperar-password']

// Endpoints chamados por serviços externos, sem sessão de utilizador
// nenhuma (cron de retenção, webhook do Google Forms) — cada um valida
// o seu próprio segredo lá dentro (CRON_SECRET / LEADS_WEBHOOK_SECRET),
// por isso não ficam à espera de login.
const PUBLIC_API_PATHS = ['/api/cron/retencao', '/api/leads/google-forms']

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_API_PATHS.includes(pathname) ||
    pathname.startsWith('/auth')
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Renova a sessão se estiver expirada. Necessário para os
  // Server Components conseguirem ler os cookies de autenticação.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
