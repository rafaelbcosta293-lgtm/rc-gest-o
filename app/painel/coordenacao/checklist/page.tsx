import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquareWarning } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { somarDias } from '@/lib/data/horarios'
import { fmt } from '@/lib/data/presencas'
import { desbloquearCoordenacao } from '../actions'
import { corEstudio, PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import RadialProgress from '@/components/RadialProgress'
import type { Estudio } from '@/lib/supabase/database.types'

const ROTA = '/painel/coordenacao/checklist'
const TIPOS = ['Abertura', 'Fecho'] as const

type Registo = {
  id: string
  tipo: string
  hora: string
  concluidos: number
  total: number
  ocorrencia: string | null
  pt: { nome: string } | { nome: string }[] | null
}
type Resposta = { registo_id: string; secao: string; item: string; ok: boolean }

export default async function CoordenacaoChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; data?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return <PortaSenha titulo="Coordenação — Checklist" destino={ROTA} action={desbloquearCoordenacao} erro={sp.erroSenha} />
  }

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  const data = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? '') && sp.data! <= hoje ? sp.data! : hoje
  const estudios = await getEstudios(supabase)
  const botao = 'rounded-full border border-border-subtle bg-surface p-1.5 text-muted shadow-card hover:text-foreground'

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/painel/coordenacao" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Resumo
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Checklists</h1>
          <p className="mt-1 text-sm text-muted">
            Abertura e fecho de cada estúdio: o que ficou por fazer e as notas de turno, sem sair da Coordenação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${ROTA}?data=${somarDias(data, -1)}`} aria-label="Dia anterior" className={botao}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-28 text-center text-sm font-semibold text-foreground">{data === hoje ? 'Hoje' : fmt(data)}</span>
          {data < hoje ? (
            <Link href={`${ROTA}?data=${somarDias(data, 1)}`} aria-label="Dia seguinte" className={botao}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className={`${botao} opacity-30`}>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
        {estudios.map((estudio) => (
          <section key={estudio.id}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corEstudio(estudio.slug).cor }} />
              <h2 className="text-lg font-semibold text-foreground">{estudio.nome}</h2>
            </div>
            <Suspense key={`${estudio.id}-${data}`} fallback={<EsqueletoEstudio />}>
              <ChecklistEstudio estudio={estudio} data={data} />
            </Suspense>
          </section>
        ))}
      </div>
    </div>
  )
}

function EsqueletoEstudio() {
  return <div className="mt-2 h-40 animate-pulse rounded-2xl border border-border-subtle bg-border-subtle" />
}

// Resumo de cada checklist do dia, aqui mesmo (antes havia só um link
// para a página do estúdio, que tirava o coordenador da Coordenação):
// quem fez, a que horas, o que ficou por assinalar e as notas de turno.
async function ChecklistEstudio({ estudio, data }: { estudio: Pick<Estudio, 'id' | 'slug'>; data: string }) {
  const supabase = await createClient()

  const { data: registosData, error } = await supabase
    .from('checklist_registos')
    .select('id, tipo, hora, concluidos, total, ocorrencia, pt:perfis!pt_id(nome)')
    .eq('estudio_id', estudio.id)
    .eq('data', data)
    .order('hora')
  if (error) throw new Error(error.message)
  const registos = (registosData ?? []) as unknown as Registo[]

  const { data: respostasData, error: erroRespostas } = registos.length
    ? await supabase
        .from('checklist_respostas')
        .select('registo_id, secao, item, ok')
        .in('registo_id', registos.map((r) => r.id))
    : { data: [], error: null }
  if (erroRespostas) throw new Error(erroRespostas.message)
  const respostas = (respostasData ?? []) as Resposta[]

  return (
    <div className="mt-2 flex flex-col gap-3">
      {TIPOS.map((tipo) => {
        // Se houver mais de um registo do mesmo tipo no dia, vale o último.
        const r = registos.filter((x) => x.tipo === tipo).pop()
        if (!r) {
          return (
            <div key={tipo} className="flex items-center gap-4 rounded-2xl border border-dashed border-border-subtle p-4">
              <RadialProgress valor={0} tamanho={48} espessura={5} cor="var(--accent)" />
              <div>
                <p className="font-semibold text-foreground">{tipo}</p>
                <p className="text-sm text-muted">Ainda não foi feita.</p>
              </div>
            </div>
          )
        }
        const pt = Array.isArray(r.pt) ? r.pt[0] : r.pt
        const completa = r.total > 0 && r.concluidos >= r.total
        const porFazer = respostas.filter((x) => x.registo_id === r.id && !x.ok)
        const porSecao = new Map<string, string[]>()
        for (const x of porFazer) porSecao.set(x.secao, [...(porSecao.get(x.secao) ?? []), x.item])
        return (
          <div key={tipo} className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
            <div className="flex items-center gap-4">
              <RadialProgress
                valor={r.total > 0 ? (r.concluidos / r.total) * 100 : 0}
                tamanho={48}
                espessura={5}
                cor={completa ? PALETA.teal.tx : 'var(--accent)'}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{tipo}</p>
                <p className="text-sm text-muted">
                  {r.hora.slice(0, 5)}
                  {pt?.nome ? ` · ${pt.nome.trim()}` : ''} · {r.concluidos} de {r.total} feitos
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  completa ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {completa ? 'Completa' : `${porFazer.length} por fazer`}
              </span>
            </div>

            {r.ocorrencia?.trim() ? (
              <div className="mt-3 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider">Notas de turno</p>
                  <p className="mt-0.5 whitespace-pre-line">{r.ocorrencia.trim()}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">Sem notas de turno.</p>
            )}

            {porFazer.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Ficou por assinalar</p>
                <div className="mt-1 flex flex-col gap-1.5">
                  {[...porSecao.entries()].map(([secao, itens]) => (
                    <div key={secao} className="text-sm">
                      <span className="text-xs font-semibold text-foreground">{secao}</span>
                      <ul className="mt-0.5 list-disc pl-5 text-muted">
                        {itens.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
