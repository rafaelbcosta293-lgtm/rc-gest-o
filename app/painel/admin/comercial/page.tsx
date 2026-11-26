import Link from '@/components/LinkRapido'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { areaBloqueada } from '@/lib/data/gate'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { somarDias } from '@/lib/data/horarios'
import { diaCurto } from '@/lib/data/presencas'
import { carregarDadosRelatorioComercial } from '@/lib/data/relatorioComercialDados'
import { Barra, BarraOpcoes, BarraPeriodo, BarraSeparador } from '@/components/Barra'
import PortaSenha from '@/components/PortaSenha'
import RelatorioComercial from '@/components/RelatorioComercial'
import { desbloquearAdmin } from '../actions'

export const metadata = { title: 'Relatório comercial' }

const ROTA = '/painel/admin/comercial'

// Relatório comercial dos dois estúdios (ou de um só): o trabalho feito
// no CRM e as taxas de cada passo, ao dia, ao mês e no acumulado do ano.
// É "vivo" — lê sempre o que está registado nas leads nesse momento.
export default async function AdminComercialPage({
  searchParams,
}: {
  searchParams: Promise<{ estudio?: string; dia?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  if (await areaBloqueada(supabase, 'admin')) {
    return <PortaSenha titulo="Administração — Relatório comercial" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const todos = await getEstudios(supabase)
  const estudios = filtrarPorEstudio(todos, sp.estudio)
  const umSo = estudios.length === 1 ? estudios[0].slug : undefined
  const hoje = hojeEmLisboa()
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && sp.dia <= hoje ? sp.dia : hoje
  const dados = await carregarDadosRelatorioComercial(
    supabase,
    estudios.map((e) => e.id),
    `${dia.slice(0, 4)}-01-01`
  )

  const link = (o: { estudio?: string; dia?: string }) => {
    const p = new URLSearchParams()
    if (o.estudio) p.set('estudio', o.estudio)
    if (o.dia && o.dia !== hoje) p.set('dia', o.dia)
    const qs = p.toString()
    return qs ? `${ROTA}?${qs}` : ROTA
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Relatório comercial</h1>
      <p className="mt-1 text-sm text-muted">
        {estudios.map((e) => e.nome).join(' + ')} · leads, contactos, marcações, visitas e inscrições, com a taxa de cada passo — ao dia, ao mês e no
        acumulado do ano.
      </p>

      <Barra rotulo="Estúdio e dia" className="mt-5 w-fit max-w-full">
        <BarraOpcoes
          opcoes={[
            { href: link({ dia }), rotulo: 'Os dois', ativo: !umSo },
            ...todos.map((e) => ({ href: link({ estudio: e.slug, dia }), rotulo: e.nome, ativo: umSo === e.slug })),
          ]}
        />
        <BarraSeparador className="sempre max-sm:hidden" />
        <BarraPeriodo
          className="max-sm:w-full"
          anterior={link({ estudio: umSo, dia: somarDias(dia, -1) })}
          seguinte={dia < hoje ? link({ estudio: umSo, dia: somarDias(dia, 1) }) : null}
          titulo={diaCurto(dia)}
          largura="17ch"
          hoje={link({ estudio: umSo })}
          noPeriodoDeHoje={dia === hoje}
        />
      </Barra>

      <div className="mt-4">
        <RelatorioComercial dados={dados} dia={dia} hoje={hoje} />
      </div>
      <NotasDoRelatorio />
    </div>
  )
}

function NotasDoRelatorio() {
  return (
    <ul className="mt-4 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
      <li>
        O <strong>mês</strong> e o <strong>ano</strong> vão do dia 1 (do mês ou de janeiro) até ao dia escolhido em cima.
      </li>
      <li>Cada taxa compara o que aconteceu dentro do mesmo período — num só dia pode passar dos 100 % (ex.: contactar hoje leads que entraram ontem).</li>
      <li>
        Uma visita conta como <strong>realizada</strong> quando a lead passa a “Experimental realizada” (ou a proposta ou inscrita). As que já passaram e não
        têm resultado aparecem como “por registar”.
      </li>
      <li>Os walk-ins não entram nas leads angariadas: contam-se à parte, com a sua própria taxa de fecho.</li>
    </ul>
  )
}
