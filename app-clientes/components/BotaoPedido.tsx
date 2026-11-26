'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import Folha from './Folha'
import { atualizar, criarPedido, estadoPedido, type TipoPedido } from '@/app/(app)/pedidosActions'

type Fase = { tipo: 'parado'; erro?: string } | { tipo: 'a_enviar' } | { tipo: 'a_confirmar' } | { tipo: 'fim'; ok: boolean; texto: string }

const ESTILOS = {
  principal: 'bg-zinc-900 text-white active:bg-zinc-800',
  secundario: 'bg-surface text-foreground ring-1 ring-zinc-300 active:bg-soft',
  discreto: 'text-zinc-700 active:bg-soft',
} as const

// Envia um pedido (reservar, cancelar, desmarcar) e espera pela resposta
// do estúdio — no máximo um minuto. Com `confirmar`, pergunta antes
// numa folha ao fundo do ecrã; com `comNota`, deixa escrever um motivo.
export default function BotaoPedido({
  tipo,
  alvo,
  rotulo,
  variante = 'principal',
  largo = false,
  confirmar,
  comNota = false,
  icone,
  avisoAnterior,
}: {
  tipo: TipoPedido
  alvo: string
  rotulo: string
  variante?: keyof typeof ESTILOS
  largo?: boolean
  confirmar?: { titulo: string; texto: string; botao: string }
  comNota?: boolean
  icone?: React.ReactNode
  // Resposta a um pedido anterior recusado (para não se perder ao voltar ao ecrã).
  avisoAnterior?: string | null
}) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>({ tipo: 'parado' })
  const [aberta, setAberta] = useState(false)
  const [nota, setNota] = useState('')
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  async function enviar() {
    setAberta(false)
    setFase({ tipo: 'a_enviar' })
    const r = await criarPedido(tipo, alvo, comNota ? nota : undefined)
    if ('erro' in r) {
      setFase({ tipo: 'parado', erro: r.erro })
      return
    }
    setFase({ tipo: 'a_confirmar' })
    const ate = Date.now() + 90_000
    while (vivo.current && Date.now() < ate) {
      await new Promise((ok) => setTimeout(ok, 2000))
      const e = await estadoPedido(r.id)
      if (e && e.estado !== 'pendente') {
        // Recusado: o botão volta, com o motivo por baixo (pode tentar de novo).
        if (e.estado === 'recusado') setFase({ tipo: 'parado', erro: e.resposta ?? 'Não foi possível. Fale com a equipa do estúdio.' })
        else setFase({ tipo: 'fim', ok: true, texto: e.resposta ?? 'Feito.' })
        await atualizar()
        router.refresh()
        return
      }
    }
    if (vivo.current) {
      setFase({ tipo: 'fim', ok: true, texto: 'Pedido enviado. A confirmação aparece aqui dentro de momentos.' })
      router.refresh()
    }
  }

  if (fase.tipo === 'fim') {
    return (
      <p aria-live="polite" className={`flex items-start gap-2 text-sm leading-snug font-medium ${fase.ok ? 'text-emerald-800' : 'text-red-800'}`}>
        {fase.ok ? <CircleCheck className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" /> : <CircleAlert className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" />}
        <span>{fase.texto}</span>
      </p>
    )
  }

  const ocupado = fase.tipo !== 'parado'
  const base =
    variante === 'discreto'
      ? `-mx-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold ${ESTILOS.discreto}`
      : `inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[0.95rem] font-semibold transition active:scale-[.985] ${largo ? 'w-full' : ''} ${ESTILOS[variante]}`

  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        aria-busy={ocupado}
        className={`${base} disabled:opacity-70`}
        onClick={() => (confirmar || comNota ? setAberta(true) : void enviar())}
      >
        {ocupado ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icone}
        {fase.tipo === 'a_enviar' ? 'A enviar…' : fase.tipo === 'a_confirmar' ? 'A confirmar…' : rotulo}
      </button>
      {fase.tipo === 'parado' && (fase.erro || avisoAnterior) && (
        <p role={fase.erro ? 'alert' : undefined} className="mt-2.5 flex items-start gap-2 text-sm leading-snug text-red-800">
          <CircleAlert className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" />
          <span>{fase.erro ?? avisoAnterior}</span>
        </p>
      )}

      <Folha titulo={confirmar?.titulo ?? rotulo} aberta={aberta} aoFechar={() => setAberta(false)}>
        {confirmar?.texto && <p className="mt-1.5 text-[0.95rem] leading-snug text-muted">{confirmar.texto}</p>}
        {comNota && (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-zinc-700">Motivo (opcional)</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Ex.: estou doente, imprevisto no trabalho…"
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-white px-3.5 py-3 text-base outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand/40"
            />
          </label>
        )}
        <div className="mt-5 grid gap-2.5">
          <button type="button" onClick={enviar} className="h-12 rounded-xl bg-zinc-900 text-[0.95rem] font-semibold text-white active:bg-zinc-800">
            {confirmar?.botao ?? 'Enviar pedido'}
          </button>
          <button type="button" onClick={() => setAberta(false)} className="h-12 rounded-xl text-[0.95rem] font-semibold text-muted active:bg-soft">
            Voltar
          </button>
        </div>
      </Folha>
    </>
  )
}
