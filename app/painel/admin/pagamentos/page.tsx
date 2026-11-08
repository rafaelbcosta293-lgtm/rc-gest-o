import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { intervaloMes, MESES } from '@/lib/data/presencas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import ListaPagamentosMes, { type LinhaPagamentoMes } from './ListaPagamentosMes'

type PagamentoRow = {
  id: string
  valor: number
  metodo: string | null
  data_pagamento: string
  inclui_seguro: boolean
  inclui_inscricao: boolean
  clientes: { nome: string; estudio_id: number } | null
  plano: { nome: string } | null
}

export default async function AdminPagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; estudio?: string; mes?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Pagamentos"
        destino="/painel/admin/pagamentos"
        action={desbloquearAdmin}
        erro={sp.erroSenha}
      />
    )
  }

  const estudios = filtrarPorEstudio(await getEstudios(supabase), sp.estudio)
  const idsEstudios = estudios.map((e) => e.id)
  const estudioPorId = new Map(estudios.map((e) => [e.id, e]))

  const hojeDate = new Date()
  const [anoMes, mesMes] = /^\d{4}-\d{2}$/.test(sp.mes ?? '')
    ? (sp.mes as string).split('-').map(Number)
    : [hojeDate.getFullYear(), hojeDate.getMonth() + 1]
  const { inicio, fimExclusivo } = intervaloMes(anoMes, mesMes)

  const { data, error } = idsEstudios.length
    ? await supabase
        .from('pagamentos_ativos')
        .select(
          'id, valor, metodo, data_pagamento, inclui_seguro, inclui_inscricao, clientes!inner(nome, estudio_id), plano:planos(nome)'
        )
        .in('clientes.estudio_id', idsEstudios)
        .gte('data_pagamento', inicio)
        .lt('data_pagamento', fimExclusivo)
        .order('data_pagamento', { ascending: false })
    : { data: [], error: null }
  if (error) {
    throw new Error(error.message)
  }

  const pagamentos = (data ?? []) as unknown as PagamentoRow[]

  const linhas: LinhaPagamentoMes[] = pagamentos
    .filter((p) => p.clientes !== null)
    .map((p) => {
      const est = estudioPorId.get(p.clientes!.estudio_id) ?? null
      return {
        id: p.id,
        nome: p.clientes!.nome,
        dataPagamento: p.data_pagamento,
        metodo: p.metodo,
        valor: p.valor,
        plano: p.plano?.nome ?? null,
        incluiSeguro: p.inclui_seguro,
        incluiInscricao: p.inclui_inscricao,
        estudioNome: est?.nome ?? null,
        estudioSlug: est?.slug ?? null,
      }
    })

  const anoMesAnterior = mesMes === 1 ? anoMes - 1 : anoMes
  const mesMesAnterior = mesMes === 1 ? 12 : mesMes - 1
  const anoMesSeguinte = mesMes === 12 ? anoMes + 1 : anoMes
  const mesMesSeguinte = mesMes === 12 ? 1 : mesMes + 1
  const qsEstudio = sp.estudio ? `&estudio=${sp.estudio}` : ''

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pagamentos</h1>
          <p className="mt-1 text-sm text-muted">{estudios.map((e) => e.nome).join(' + ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/painel/admin/pagamentos?mes=${anoMesAnterior}-${String(mesMesAnterior).padStart(2, '0')}${qsEstudio}`}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
          >
            ← {MESES[mesMesAnterior - 1].slice(0, 3)}
          </Link>
          <strong className="text-sm text-foreground">
            {MESES[mesMes - 1]} {anoMes}
          </strong>
          <Link
            href={`/painel/admin/pagamentos?mes=${anoMesSeguinte}-${String(mesMesSeguinte).padStart(2, '0')}${qsEstudio}`}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
          >
            {MESES[mesMesSeguinte - 1].slice(0, 3)} →
          </Link>
        </div>
      </div>

      <ListaPagamentosMes linhas={linhas} mostrarEstudio={estudios.length > 1} />
    </div>
  )
}
