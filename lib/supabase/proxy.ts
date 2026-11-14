import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ehContaFixa, permissoesDaConta, slugEstudioDoEmailPartilhado } from '@/lib/data/acessos'
import { NOME_COOKIE, chaveAtivoDispositivo } from '@/lib/data/dispositivo'

// Páginas que qualquer visitante pode ver sem ter sessão iniciada.
// Tudo o resto (ex.: /painel) exige login.
const PUBLIC_PATHS = ['/', '/login', '/registo', '/recuperar-password']

// Endpoints chamados por serviços externos, sem sessão de utilizador
// nenhuma (cron de retenção, webhooks de leads) — cada um valida o seu
// próprio segredo lá dentro (CRON_SECRET / LEADS_WEBHOOK_SECRET /
// META_VERIFY_TOKEN), por isso não ficam à espera de login.
const PUBLIC_API_PATHS = [
  '/api/cron/retencao',
  '/api/cron/presencas-calendario',
  '/api/cron/presencas-agenda',
  '/api/cron/alertas',
  '/api/cron/kpi-snapshot',
  '/api/cron/estado-clientes',
  '/api/cron/agenda-series',
  '/api/cron/lembretes-sms',
  '/api/cron/aniversarios-sms',
  '/api/cron/backup',
  '/api/leads/google-forms',
  '/api/webhooks/leads',
  '/api/webhooks/facebook',
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

  // Contas partilhadas dos estúdios: se o computador deixar de estar
  // autorizado depois de a sessão já ter sido aberta (ou a restrição
  // for ativada só depois do login), corta aqui também — não chega
  // bloquear no login, ver lib/data/dispositivo.ts.
  if (session && !isPublicPath(request.nextUrl.pathname)) {
    const slugPartilhado = slugEstudioDoEmailPartilhado(session.user.email ?? null)
    const chaveAtivo = slugPartilhado ? chaveAtivoDispositivo(slugPartilhado) : undefined
    if (slugPartilhado && chaveAtivo) {
      const { data } = await supabase.from('config').select('valor').eq('chave', chaveAtivo).maybeSingle()
      const autorizado = request.cookies.get(NOME_COOKIE[slugPartilhado])?.value === '1'
      if (data?.valor && !autorizado) {
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set(
          'error',
          'Este computador não está autorizado para a conta deste estúdio. Pede ao dono para o autorizar em Administração → Serviços/Produtos.'
        )
        // signOut() só limpa as cookies de sessão em supabaseResponse (via
        // o setAll acima) — como aqui se devolve um redirect novo, é
        // preciso copiar essas cookies para ele, senão a sessão ficava
        // por fechar no browser.
        const redirectResponse = NextResponse.redirect(url)
        for (const cookie of supabaseResponse.cookies.getAll()) {
          redirectResponse.cookies.set(cookie)
        }
        return redirectResponse
      }
    }
  }

  // Uma conta pessoal (fora das 4 contas fixas do negócio) só abre os
  // módulos que lhe foram dados — feito aqui (não só a esconder o link
  // no menu, ver layout.tsx) para um pedido direto a outro URL nunca
  // passar. "admin"/"coordenacao" não são slugs de estúdio (são as suas
  // próprias áreas, já geridas à parte), por isso ficam de fora.
  if (session && !isPublicPath(request.nextUrl.pathname) && !ehContaFixa(session.user.email ?? null)) {
    const match = request.nextUrl.pathname.match(/^\/painel\/([^/]+)\/([^/]+)/)
    // Os módulos de cada conta pessoal vêm do próprio token (app_metadata,
    // definido pela Administração) — sem consulta à base de dados aqui.
    const { modulos } = permissoesDaConta(session.user.app_metadata)
    if (match && match[1] !== 'admin' && match[1] !== 'coordenacao' && !modulos.includes(match[2])) {
      const url = request.nextUrl.clone()
      // Sem nenhum módulo atribuído volta à escolha de estúdio (nunca
      // para um módulo que também seria recusado — dava um ciclo).
      url.pathname = modulos.length > 0 ? `/painel/${match[1]}/${modulos[0]}` : '/painel'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
