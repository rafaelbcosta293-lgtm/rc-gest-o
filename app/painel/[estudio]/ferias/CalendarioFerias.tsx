'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import {
  diasDoMesISO,
  diasUteisEm,
  diaDaSemana,
  ehDiaUtil,
  intervaloDias,
  motivoBloqueioFerias,
  type BloqueioFerias,
} from '@/lib/data/assiduidade'
import { MESES } from '@/lib/data/presencas'
import SubmitButton from '@/components/SubmitButton'
import { pedirFerias } from './actions'

const DIAS_CAB = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const MENSAGEM_SAIR =
  'Tens alterações por guardar no teu Mapa de Férias. Guarda para submeter à aprovação da administração ou descarta as alterações.'

export type EstadoDiaProprio = 'Pendente' | 'Aprovado'

export default function CalendarioFerias({
  estudioSlug,
  ano,
  hoje,
  slugFeriados,
  estudioId,
  bloqueios,
  outrosDeFerias,
  limiteSimultaneo,
  meusDias,
}: {
  estudioSlug: string
  ano: number
  hoje: string
  slugFeriados: string
  estudioId: number
  bloqueios: BloqueioFerias[]
  outrosDeFerias: Record<string, number>
  limiteSimultaneo: number | null
  meusDias: Record<string, EstadoDiaProprio>
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [saidaPendente, setSaidaPendente] = useState<string | null>(null)
  const { marcarSujo, limparSujo } = useAvisoSairSemGuardar({ aoTentarSair: (href) => setSaidaPendente(href) })

  const ocupados = useMemo(() => new Map(Object.entries(outrosDeFerias)), [outrosDeFerias])
  const motivo = (d: string) =>
    motivoBloqueioFerias(d, {
      slug: slugFeriados,
      estudioId,
      bloqueios,
      outrosDeFerias: ocupados,
      limiteSimultaneo,
    })

  function alternar(d: string) {
    setSelecionados((atual) => {
      const novo = atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()
      if (novo.length > 0) marcarSujo()
      else limparSujo()
      return novo
    })
  }

  function descartar() {
    setSelecionados([])
    limparSujo()
    const destino = saidaPendente
    setSaidaPendente(null)
    if (destino) router.push(destino)
  }

  return (
    <div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MESES.map((nomeMes, i) => {
          const dias = diasDoMesISO(ano, i + 1)
          const offset = (diaDaSemana(dias[0]) + 6) % 7
          return (
            <div key={nomeMes} className="rounded-xl border border-border-subtle bg-surface p-3 shadow-card">
              <p className="text-sm font-semibold text-foreground">{nomeMes}</p>
              <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted">
                {DIAS_CAB.map((d, j) => (
                  <span key={j}>{d}</span>
                ))}
              </div>
              <div className="mt-0.5 grid grid-cols-7 gap-0.5">
                {Array.from({ length: offset }).map((_, j) => (
                  <span key={`v${j}`} />
                ))}
                {dias.map((d) => {
                  const proprio = meusDias[d]
                  const bloqueio = proprio ? null : motivo(d)
                  const passado = d < hoje
                  const escolhido = selecionados.includes(d)
                  const naoUtil = !ehDiaUtil(d, slugFeriados)
                  const desativado = !!proprio || !!bloqueio || passado
                  let cls = 'text-foreground hover:bg-brand/15'
                  if (escolhido) cls = 'bg-brand font-bold text-black'
                  else if (proprio === 'Aprovado') cls = 'bg-emerald-600 font-semibold text-white'
                  else if (proprio === 'Pendente') cls = 'border border-dashed border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  else if (bloqueio && !naoUtil) cls = 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  else if (naoUtil || passado) cls = 'text-muted opacity-40'
                  const titulo = proprio
                    ? proprio === 'Aprovado'
                      ? 'Férias aprovadas'
                      : 'Aguarda aprovação'
                    : bloqueio ?? (passado ? 'Dia já passou' : 'Escolher este dia')
                  return (
                    <button
                      key={d}
                      type="button"
                      title={titulo}
                      disabled={desativado}
                      onClick={() => alternar(d)}
                      className={`relative flex aspect-square items-center justify-center rounded-md text-[11px] transition-colors disabled:cursor-not-allowed ${cls}`}
                    >
                      {Number(d.slice(8, 10))}
                      {bloqueio && !naoUtil && !proprio && (
                        <Lock className="absolute right-0 top-0 h-2.5 w-2.5" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand" /> Selecionado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-amber-500 bg-amber-100" /> Aguarda aprovação</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-600" /> Aprovado</span>
        <span className="inline-flex items-center gap-1.5"><span className="relative h-3 w-3 rounded bg-zinc-200 dark:bg-zinc-800" /> Bloqueado (passa o rato para ver o motivo)</span>
      </div>

      <form
        ref={formRef}
        action={pedirFerias}
        className={`sticky bottom-20 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle bg-surface/95 p-4 shadow-card backdrop-blur md:bottom-4 ${
          selecionados.length === 0 ? 'hidden' : ''
        }`}
      >
        <input type="hidden" name="estudio_slug" value={estudioSlug} />
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="dias" value={JSON.stringify(selecionados)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {selecionados.length} {selecionados.length === 1 ? 'dia' : 'dias'} · {diasUteisEm(selecionados, slugFeriados)} úteis ·{' '}
            {intervaloDias(selecionados)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Ao guardar, os dias selecionados serão enviados obrigatoriamente para aprovação da administração. O calendário
            oficial só será atualizado após validação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelecionados([])
            limparSujo()
          }}
          className="rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
        >
          Limpar
        </button>
        <SubmitButton pendingText="A enviar…" className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-black">
          Guardar & Pedir Aprovação
        </SubmitButton>
      </form>

      {saidaPendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-card">
            <p className="text-base font-semibold text-foreground">Alterações por guardar</p>
            <p className="mt-2 text-sm text-muted">{MENSAGEM_SAIR}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaidaPendente(null)}
                className="rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
              >
                Continuar a editar
              </button>
              <button
                type="button"
                onClick={descartar}
                className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                Descartar alterações
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaidaPendente(null)
                  formRef.current?.requestSubmit()
                }}
                className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-black"
              >
                Guardar & Pedir Aprovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
