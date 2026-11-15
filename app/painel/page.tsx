import { Suspense } from 'react'
import Link from '@/components/LinkRapido'
import { ArrowRight, ArrowLeft, Network, ShieldCheck, Church, Castle, Landmark, type LucideIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { getSessaoAtual } from '@/lib/data/sessao'
import { corEstudio } from '@/lib/data/constantes'
import { podeAcederAdmin, podeAcederCoordenacao, podeAcederEstudio } from '@/lib/data/acessos'
import AvisosHorario from '@/components/AvisosHorario'

// Um símbolo do estúdio em vez de uma letra solta — o marco que
// identifica cada cidade (Santuário de Fátima / Castelo de Leiria).
// Um estúdio novo, sem marco definido ainda, cai no genérico.
const ICONE_ESTUDIO: Record<string, LucideIcon> = {
  fatima: Church,
  leiria: Castle,
}

function iconeEstudio(slug: string) {
  return ICONE_ESTUDIO[slug] ?? Landmark
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await createClient()

  // Tudo de uma vez: a sessão, os estúdios, a contagem de clientes e as
  // aprovações de acesso a estúdios (filtradas mais abaixo para ficarem
  // só as desta conta).
  const [sessao, estudios, { data: clientes }, { data: acessosAprovados }] = await Promise.all([
    getSessaoAtual(),
    getEstudios(supabase),
    supabase.from('clientes').select('estudio_id, estado'),
    supabase.from('perfis_estudios').select('perfil_id, estudio_id'),
  ])

  if (!sessao.userId) {
    redirect('/login')
  }

  const email = sessao.email
  // Além das contas fixas (podeAcederEstudio), uma conta pessoal
  // já aprovada em Equipa ("Dar acesso") também vê o seu estúdio aqui —
  // ver podeAcederEstudioAprovado em lib/data/acessos.ts.
  const idsAprovados = new Set(
    (acessosAprovados ?? []).filter((a) => a.perfil_id === sessao.userId).map((a) => a.estudio_id)
  )
  const estudiosVisiveis = estudios.filter((e) => podeAcederEstudio(email, e.slug) || idsAprovados.has(e.id))
  const temCoordenacao = podeAcederCoordenacao(email)
  const temAdmin = podeAcederAdmin(email)

  const contagem = (estudioId: number) =>
    (clientes ?? []).filter((c) => c.estudio_id === estudioId && c.estado === 'Ativo').length

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Em que estúdio estás?
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sessão iniciada como {email}
        </p>
      </div>

      <div className="w-full max-w-2xl overflow-hidden rounded-xl empty:hidden">
        {/* Em Suspense: o aviso tem a sua própria consulta e, sem isto, a
            página inteira só era enviada depois de ela responder. Assim a
            página sai logo e o aviso entra quando chegar. */}
        <Suspense fallback={null}>
          <AvisosHorario supabase={supabase} userId={sessao.userId} email={email} />
        </Suspense>
      </div>

      {erro === 'sem-acesso' && (
        <p className="w-full max-w-2xl rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          A tua conta não tem acesso a essa área.
        </p>
      )}

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {estudiosVisiveis.map((e) => {
          const cor = corEstudio(e.slug)
          const Icone = iconeEstudio(e.slug)
          const n = contagem(e.id)
          return (
            <Link
              key={e.id}
              href={`/painel/${e.slug}`}
              className="group rounded-3xl border border-border-subtle bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-card-hover"
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-pop ring-1 ring-[#D9B96A]/40 ring-offset-2 ring-offset-surface transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${cor.cor}, color-mix(in srgb, ${cor.cor} 100%, black 32%))`,
                }}
              >
                <Icone className="h-7 w-7" strokeWidth={2} />
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
                {e.nome}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {n} {n === 1 ? 'cliente ativo' : 'clientes ativos'}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-foreground transition-transform group-hover:translate-x-0.5">
                Entrar <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          )
        })}

        {temCoordenacao && (
          <Link
            href="/painel/coordenacao"
            className="group rounded-3xl border border-border-subtle bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-card-hover"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E2EEFC] text-[#1D5FA8] shadow-pop">
              <Network className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
              Coordenação
            </h2>
            <p className="mt-1 text-sm text-muted">
              Fátima e Leiria, na mesma página.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-foreground transition-transform group-hover:translate-x-0.5">
              Entrar <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}
        {temAdmin && (
          <Link
            href="/painel/admin"
            className="group rounded-3xl border border-border-subtle bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-card-hover"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EBE6F8] text-[#5B3FA0] shadow-pop">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
              Administração
            </h2>
            <p className="mt-1 text-sm text-muted">
              Fátima e Leiria, na mesma página.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-foreground transition-transform group-hover:translate-x-0.5">
              Entrar <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}
      </div>

      {estudios.length === 0 && (
        <p className="text-sm text-muted">
          Ainda não há nenhum estúdio configurado na base de dados.
        </p>
      )}
      {estudios.length > 0 && estudiosVisiveis.length === 0 && !temCoordenacao && !temAdmin && (
        <p className="max-w-md text-center text-sm text-muted">
          A tua conta ainda não tem acesso a nenhuma área desta app. Contacta a administração.
        </p>
      )}

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao início
      </Link>
    </div>
  )
}
