import Link from 'next/link'
import { ArrowLeft, UserPlus, Euro, Dumbbell, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { getEvolucaoMensal } from '@/lib/data/evolucaoMensal'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from './actions'
import { corGraficoEstudio } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import GraficoEvolucao from '@/components/GraficoEvolucao'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const { error, erroSenha } = sp

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha titulo="Administração" destino="/painel/admin" action={desbloquearAdmin} erro={erroSenha} />
    )
  }

  const estudios = await getEstudios(supabase)
  const ano = new Date().getFullYear()
  const evolucao = await getEvolucaoMensal(supabase, estudios, ano)

  function series(serieEstudio: typeof evolucao.novosSocios) {
    return serieEstudio.map((s) => ({
      nome: s.nome,
      cor: corGraficoEstudio(s.slug),
      pontos: s.pontos.map((p) => p.valor),
    }))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href="/painel"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trocar de conta
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Administração</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <span className="live-dot" aria-hidden />
        {estudios.map((e) => e.nome).join(' e ')} · {ano}, mês a mês.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Novos sócios
              <span
                title="O total de sócios ativos ao longo do ano não dá para mostrar com rigor: isso precisava de saber quando cada ex-cliente saiu, e essa data nunca foi registada. Em vez disso: novos sócios por mês (100% fiável) e o total ativo agora, ao lado."
                aria-label="Porquê 'novos sócios' e não 'ativos'"
                tabIndex={0}
                className="cursor-help text-muted/70"
              >
                <Info className="h-3 w-3" strokeWidth={2} />
              </span>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-muted">
              {evolucao.ativosAgora.reduce((soma, e) => soma + e.total, 0)} ativos agora
            </span>
          </div>
          <div className="mt-3">
            <GraficoEvolucao meses={evolucao.meses} series={series(evolucao.novosSocios)} unidade="numero" />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Euro className="h-3.5 w-3.5" strokeWidth={2.25} />
            Faturação
          </div>
          <div className="mt-3">
            <GraficoEvolucao meses={evolucao.meses} series={series(evolucao.faturacao)} unidade="euro" />
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Dumbbell className="h-3.5 w-3.5" strokeWidth={2.25} />
            Treinos realizados
          </div>
          <div className="mt-3">
            <GraficoEvolucao
              meses={evolucao.meses}
              series={series(evolucao.treinosRealizados)}
              unidade="numero"
            />
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">
        Usa o menu no topo para ver os detalhes por estúdio (Este mês, Agora), relatórios, financeiro
        e as restantes áreas.
      </p>
    </div>
  )
}
