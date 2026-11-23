'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EscopoAula } from '@/lib/data/aulas'
import type { AulaNaAgenda } from '../agenda/AgendaInterativa'
import { mudarAulaRapido } from './actions'

// O que se pediu ao arrastar (ou esticar) uma aula na grelha.
type PedidoAula = { id: string; data: string; horaInicio: string; duracaoMin: number }

const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const diaLongo = (iso: string) => DIAS_LONGOS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Arrastar e esticar aulas de grupo na grelha (no mapa de aulas e na
// Agenda), com as mesmas regras dos treinos: numa aula que se repete
// pergunta-se se a mudança é só para esta, para esta e as seguintes, ou
// para todas as da série. Se a aula já tem inscritos, pede-se sempre
// confirmação (é preciso avisá-los).
export function useEdicaoAulas({
  slug,
  aulas,
  diasFechados,
}: {
  slug: string
  aulas: AulaNaAgenda[]
  diasFechados: Record<string, string>
}) {
  const router = useRouter()
  const [pedido, setPedido] = useState<PedidoAula | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aGravar, iniciar] = useTransition()

  function aplicar(p: PedidoAula, escopo: EscopoAula) {
    setPedido(null)
    setErro(null)
    iniciar(async () => {
      const r = await mudarAulaRapido({ estudioSlug: slug, aulaId: p.id, escopo, data: p.data, horaInicio: p.horaInicio, duracaoMin: p.duracaoMin })
      if ('error' in r) setErro(r.error)
      else {
        if (r.retiradas > 0) {
          setErro(`${r.retiradas} aula(s) da série caíam num dia em que o estúdio está fechado e foram retiradas (não tinham inscritos).`)
        }
        router.refresh()
      }
    })
  }

  function pedir(p: PedidoAula) {
    const aula = aulas.find((a) => a.id === p.id)
    if (!aula) return
    if (p.data !== aula.data && diasFechados[p.data]) {
      setErro(`O estúdio está fechado neste dia (${diasFechados[p.data]}) — não se podem marcar aulas.`)
      return
    }
    if (aula.horarioId || aula.inscritos > 0) setPedido(p)
    else aplicar(p, 'um')
  }

  function moverAula(id: string, data: string, horaInicio: string) {
    const aula = aulas.find((a) => a.id === id)
    if (aula) pedir({ id, data, horaInicio, duracaoMin: aula.duracao_min })
  }

  function redimensionarAula(id: string, horaInicio: string, duracaoMin: number) {
    const aula = aulas.find((a) => a.id === id)
    if (aula) pedir({ id, data: aula.data, horaInicio, duracaoMin })
  }

  const aulaDoPedido = pedido ? (aulas.find((a) => a.id === pedido.id) ?? null) : null
  const dialogo =
    pedido && aulaDoPedido ? (
      <PerguntaAula pedido={pedido} aula={aulaDoPedido} onEscolher={(e) => aplicar(pedido, e)} onCancelar={() => setPedido(null)} />
    ) : null

  return { moverAula, redimensionarAula, dialogo, erro, limparErro: () => setErro(null), aGravar }
}

// A caixa que aparece ao largar uma aula: a que aulas aplicar a mudança.
function PerguntaAula({
  pedido,
  aula,
  onEscolher,
  onCancelar,
}: {
  pedido: PedidoAula
  aula: AulaNaAgenda
  onEscolher: (escopo: EscopoAula) => void
  onCancelar: () => void
}) {
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onCancelar])

  const mudaDia = pedido.data !== aula.data
  const mudaDuracao = pedido.duracaoMin !== aula.duracao_min
  const descricao = mudaDia
    ? `De ${diaLongo(aula.data)} ${diaMes(aula.data)} às ${aula.hora_inicio.slice(0, 5)} para ${diaLongo(pedido.data)} ${diaMes(pedido.data)} às ${pedido.horaInicio.slice(0, 5)}.`
    : mudaDuracao
      ? `Passa a ser às ${pedido.horaInicio.slice(0, 5)}, com ${pedido.duracaoMin} min.`
      : `Passa a começar às ${pedido.horaInicio.slice(0, 5)}.`
  const repete = !!aula.horarioId
  const botao =
    'w-full rounded-xl border border-border-subtle px-4 py-2.5 text-left text-sm hover:border-brand hover:bg-brand/[.08] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-subtle disabled:hover:bg-transparent pointer-coarse:py-3.5'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={repete ? 'Aula que se repete' : 'Mudar a aula'}
        className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-foreground">{repete ? 'Esta aula repete-se todas as semanas' : 'Mudar esta aula?'}</h2>
        <p className="mt-1 text-sm text-muted">
          {aula.servicoNome}. {descricao}
          {repete ? ' A que aulas aplicar?' : ''}
        </p>
        {aula.inscritos > 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Esta aula tem {aula.inscritos} {aula.inscritos === 1 ? 'pessoa inscrita' : 'pessoas inscritas'} — avisa-{aula.inscritos === 1 ? 'a' : 'as'} da mudança.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {repete ? (
            <>
              <button type="button" autoFocus onClick={() => onEscolher('um')} className={botao}>
                <span className="font-semibold text-foreground">Só esta</span>
              </button>
              <button type="button" onClick={() => onEscolher('seguintes')} className={botao}>
                <span className="font-semibold text-foreground">Esta e as seguintes</span>
              </button>
              <button type="button" onClick={() => onEscolher('serie')} className={botao}>
                <span className="font-semibold text-foreground">Todas as da série</span>
              </button>
            </>
          ) : (
            <button type="button" autoFocus onClick={() => onEscolher('um')} className={botao}>
              <span className="font-semibold text-foreground">Mudar a aula</span>
            </button>
          )}
        </div>
        {repete && (
          <p className="mt-3 text-xs text-muted">
            {mudaDia ? 'As outras aulas mudam o mesmo número de dias, e o horário semanal fica no dia novo. ' : 'O horário semanal fica com a hora nova. '}
            As que já aconteceram ou foram canceladas ficam como estão.
          </p>
        )}
        <button type="button" onClick={onCancelar} className="mt-3 w-full text-center text-xs font-semibold text-muted underline hover:text-foreground">
          Cancelar (não mudar nada)
        </button>
      </div>
    </div>
  )
}
