import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Páginas que qualquer visitante pode ver sem ter sessão iniciada.
// Tudo o resto (ex.: /painel) exige login.
const PUBLIC_PATHS = ['/', '/login', '/registo', '/recuperar-password']

// Login próprio dos clientes (separado do da equipa) — isPublicPath só
// decide SE é preciso sessão; qual página de login usar é decidido à
// parte, em getLoginPath, consoante o prefixo do pedido. /cliente/ativar
// também fica aqui porque a própria página já trata os dois casos (com
// e sem sessão válida) com uma mensagem própria — não faz sentido o
// proxy intercetar antes disso com um redireciono genérico.
const CLIENTE_PUBLIC_PATHS = ['/cliente/entrar', '/cliente/recuperar-password', '/cliente/ativar']

// Endpoints chamados por serviços externos, sem sessão de utilizador
// nenhuma (cron de retenção, webhook do Google Forms) — cada um valida
// o seu próprio segredo lá dentro (CRON_SECRET / LEADS_WEBHOOK_SECRET),
// por isso não ficam à espera de login.
const PUBLIC_API_PATHS = [
  '/api/cron/retencao',
  '/api/cron/presencas-calendario',
  '/api/leads/google-forms',
]

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    CLIENTE_PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_API_PATHS.includes(pathname) ||
    pathname.startsWith('/auth')
  )
}

// /cliente/** sem sessão volta para o login dos clientes, não para o
// da equipa — são áreas e contas completamente separadas.
function getLoginPath(pathname: string) {
  return pathname.startsWith('/cliente') ? '/cliente/entrar' : '/login'
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
    const destino = request.nextUrl.pathname
    const url = request.nextUrl.clone()
    url.pathname = getLoginPath(destino)
    // Em /cliente, guarda para onde voltar depois do login — importa
    // sobretudo para o check-in por QR (digitalizar sem sessão ativa
    // não pode perder-se a caminho do login). Em /painel mantém-se
    // exatamente o comportamento de sempre, sem mexer na query.
    if (destino.startsWith('/cliente')) {
      url.search = ''
      url.searchParams.set('next', destino + request.nextUrl.search)
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
