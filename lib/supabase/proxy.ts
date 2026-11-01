import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Páginas que qualquer visitante pode ver sem ter sessão iniciada.
// Tudo o resto (ex.: /painel) exige login.
const PUBLIC_PATHS = ['/', '/login', '/registo', '/recuperar-password']

// Endpoints chamados por serviços externos, sem sessão de utilizador
// nenhuma (cron de retenção, webhook do Google Forms) — cada um valida
// o seu próprio segredo lá dentro (CRON_SECRET / LEADS_WEBHOOK_SECRET),
// por isso não ficam à espera de login.
const PUBLIC_API_PATHS = [
  '/api/cron/retencao',
  '/api/cron/presencas-calendario',
  '/api/cron/presencas-agenda',
  '/api/cron/alertas',
  '/api/cron/kpi-snapshot',
  '/api/cron/estado-clientes',
  '/api/cron/lembretes-sms',
  '/api/cron/aniversarios-sms',
  '/api/leads/google-forms',
]

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

  // getSession() lê a sessão da cookie sem ir à rede, e só contacta a
  // Supabase para renovar o token quando este já expirou (ou está perto
  // disso) — ao contrário de getUser(), que valida sempre no servidor,
  // em todos os pedidos. Isto é seguro aqui porque o proxy só decide se
  // mostra a página ou redireciona para /login; a verificação a sério
  // continua a acontecer sempre (lib/data/sessao.ts chama getUser(), e
  // a RLS de cada tabela nunca confia em nada que venha de aqui).
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
