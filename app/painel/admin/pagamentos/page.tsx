import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { intervaloMes, MESES } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
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

type Vista = 'dia' | 'mes' | 'ano'

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// Intervalo [inicio, fimExclusivo) e navegação para a vista escolhida.
function resolverPeriodo(vista: Vista, sp: { dia?: string; mes?: string; ano?: string }, hoje: string) {
  if (vista === 'dia') {
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? '') ? sp.dia! : hoje
    const ant = somarDias(dia, -1)
    const seg = somarDias(dia, 1)
    return {
      inicio: dia,
      fimExclusivo: seg,
      rotulo: new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      anterior: { qs: `dia=${ant}`, rotulo: ddmm(ant) },
      seguinte: { qs: `dia=${seg}`, rotulo: ddmm(seg) },
    }
  }
  if (vista === 'ano') {
    const ano = /^\d{4}$/.test(sp.ano ?? '') ? Number(sp.ano) : Number(hoje.slice(0, 4))
    return {
      inicio: `${ano}-01-01`,
      fimExclusivo: `${ano + 1}-01-01`,
      rotulo: String(ano),
      anterior: { qs: `ano=${ano - 1}`, rotulo: String(ano - 1) },
      seguinte: { qs: `ano=${ano + 1}`, rotulo: String(ano + 1) },
    }
  }
  const [ano, mes] = /^\d{4}-\d{2}$/.test(sp.mes ?? '')
    ? sp.mes!.split('-').map(Number)
    : [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))]
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const anoAnt = mes === 1 ? ano - 1 : ano
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoSeg = mes === 12 ? ano + 1 : ano
  const mesSeg = mes === 12 ? 1 : mes + 1
  return {
    inicio,
    fimExclusivo,
    rotulo: `${MESES[mes - 1]} ${ano}`,
    anterior: { qs: `mes=${anoAnt}-${String(mesAnt).padStart(2, '0')}`, rotulo: MESES[mesAnt - 1].slice(0, 3) },
    seguinte: { qs: `mes=${anoSeg}-${String(mesSeg).padStart(2, '0')}`, rotulo: MESES[mesSeg - 1].slice(0, 3) },
  }
}

export default async function AdminPagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; estudio?: string; mes?: string; dia?: string; ano?: string; vista?: string }>
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

  // Dia, mês (por omissão) ou ano — sempre pela data de Lisboa.
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  const vista: Vista = sp.vista === 'dia' || sp.vista === 'ano' ? sp.vista : 'mes'
  const periodo = resolverPeriodo(vista, sp, hoje)

  // Um ano inteiro passa as 1000 linhas que a API devolve de uma vez.
  const { data, error } = idsEstudios.length
    ? await todasAsLinhas(
        (de, ate) =>
          supabase
            .from('pagamentos_ativos')
            .select(
              'id, valor, metodo, data_pagamento, inclui_seguro, inclui_inscricao, clientes!inner(nome, estudio_id), plano:planos(nome)'
            )
            .in('clientes.estudio_id', idsEstudios)
            .gte('data_pagamento', periodo.inicio)
            .lt('data_pagamento', periodo.fimExclusivo)
            .order('data_pagamento', { ascending: false })
            .order('id')
            .range(de, ate),
        { emParalelo: vista === 'ano' ? 3 : 1 }
      )
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

  const qsEstudio = sp.estudio ? `&estudio=${sp.estudio}` : ''
  const linkVista = (v: Vista, extra = '') =>
    `/painel/admin/pagamentos?vista=${v}${extra ? `&${extra}` : ''}${qsEstudio}`

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border-subtle p-0.5">
            {(
              [
                ['dia', 'Dia'],
                ['mes', 'Mês'],
                ['ano', 'Ano'],
              ] as const
            ).map(([v, nome]) => (
              <Link
                key={v}
                href={linkVista(v)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  vista === v ? 'bg-brand text-black' : 'text-muted hover:text-foreground'
                }`}
              >
                {nome}
              </Link>
            ))}
          </div>
          <Link
            href={linkVista(vista, periodo.anterior.qs)}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
          >
            ← {periodo.anterior.rotulo}
          </Link>
          <strong className="text-sm capitalize text-foreground">{periodo.rotulo}</strong>
          <Link
            href={linkVista(vista, periodo.seguinte.qs)}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
          >
            {periodo.seguinte.rotulo} →
          </Link>
          {vista === 'dia' && (
            <form action="/painel/admin/pagamentos" className="flex items-center gap-1">
              <input type="hidden" name="vista" value="dia" />
              {sp.estudio && <input type="hidden" name="estudio" value={sp.estudio} />}
              <input
                type="date"
                name="dia"
                defaultValue={periodo.inicio}
                className="rounded-md border border-border-subtle bg-background px-2 py-1 text-sm text-foreground"
              />
              <button
                type="submit"
                className="rounded-md border border-border-subtle px-2 py-1 text-sm text-muted hover:text-foreground"
              >
                Ir
              </button>
            </form>
          )}
        </div>
      </div>

      <ListaPagamentosMes
        linhas={linhas}
        periodo={vista === 'mes' ? 'mês' : vista}
        mostrarEstudio={estudios.length > 1}
      />
    </div>
  )
}
