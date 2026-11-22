'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { atualizar, criarPedido, estadoPedido, type TipoPedido } from '@/app/(app)/pedidosActions'

type Fase = { tipo: 'parado' } | { tipo: 'a_enviar' } | { tipo: 'a_confirmar'; id: string } | { tipo: 'fim'; ok: boolean; texto: string }

// Envia um pedido e espera pela resposta da equipa/gestão (alguns
// segundos). Mostra o resultado e atualiza a página.
export default function BotaoPedido({
  tipo,
  alvo,
  rotulo,
  variante = 'principal',
  confirmar,
  comNota = false,
  emCurso = false,
}: {
  tipo: TipoPedido
  alvo: string
  rotulo: string
  variante?: 'principal' | 'secundario'
  confirmar?: string
  comNota?: boolean
  emCurso?: boolean
}) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>(emCurso ? { tipo: 'fim', ok: true, texto: 'Pedido em curso…' } : { tipo: 'parado' })
  const [aberto, setAberto] = useState(false)
  const [nota, setNota] = useState('')
  const vivo = useRef(true)
  useEffect(() => () => void (vivo.current = false), [])

  async function enviar() {
    if (confirmar && !comNota && !window.confirm(confirmar)) return
    setFase({ tipo: 'a_enviar' })
    const r = await criarPedido(tipo, alvo, comNota ? nota : undefined)
    if ('erro' in r) {
      setFase({ tipo: 'fim', ok: false, texto: r.erro })
      return
    }
    setFase({ tipo: 'a_confirmar', id: r.id })
    const ate = Date.now() + 120_000
    while (vivo.current && Date.now() < ate) {
      await new Promise((ok) => setTimeout(ok, 2500))
      const e = await estadoPedido(r.id)
      if (e && e.estado !== 'pendente') {
        setFase({ tipo: 'fim', ok: e.estado !== 'recusado', texto: e.resposta ?? (e.estado === 'recusado' ? 'Pedido recusado.' : 'Feito.') })
        await atualizar()
        router.refresh()
        return
      }
    }
    if (vivo.current) setFase({ tipo: 'fim', ok: true, texto: 'Pedido enviado. A confirmação aparece aqui em breve.' })
  }

  const classeBotao =
    variante === 'principal'
      ? 'h-10 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white active:scale-[.98] disabled:opacity-50'
      : 'h-10 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 active:scale-[.98] disabled:opacity-50'

  if (fase.tipo === 'a_enviar' || fase.tipo === 'a_confirmar') {
    return (
      <p className="text-sm text-muted" aria-live="polite">
        {fase.tipo === 'a_enviar' ? 'A enviar…' : 'A confirmar com o estúdio…'}
      </p>
    )
  }
  if (fase.tipo === 'fim') {
    return (
      <p aria-live="polite" className={`text-sm ${fase.ok ? 'text-emerald-700' : 'text-red-700'}`}>
        {fase.texto}
      </p>
    )
  }
  if (comNota && !aberto) {
    return (
      <button type="button" className={classeBotao} onClick={() => setAberto(true)}>
        {rotulo}
      </button>
    )
  }
  if (comNota) {
    return (
      <div className="w-full space-y-2">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Motivo (opcional)"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-strong"
        />
        <div className="flex gap-2">
          <button type="button" className={classeBotao} onClick={enviar}>
            Enviar pedido
          </button>
          <button type="button" className="h-10 px-3 text-sm text-muted" onClick={() => setAberto(false)}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }
  return (
    <button type="button" className={classeBotao} onClick={enviar}>
      {rotulo}
    </button>
  )
}
