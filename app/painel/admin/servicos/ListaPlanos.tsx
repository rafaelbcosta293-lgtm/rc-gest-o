'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { atualizarPlano, apagarPlano, reordenarPlanos } from './actions'
import type { Plano, Servico } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

// Lista arrastável (pega à esquerda de cada linha, ao estilo
// Trello/Notion) — a ordem em ecrã atualiza-se logo ao arrastar, por
// cima da lista que veio do servidor; só ao soltar é que grava a ordem
// nova, de uma vez, e volta a sincronizar com o servidor.
export default function ListaPlanos({ planos: planosIniciais, servicos }: { planos: Plano[]; servicos: Servico[] }) {
  const router = useRouter()
  const [planos, setPlanos] = useState(planosIniciais)
  const [arrastadoId, setArrastadoId] = useState<string | null>(null)

  function arrastarSobre(idAlvo: string) {
    if (!arrastadoId || arrastadoId === idAlvo) return
    setPlanos((lista) => {
      const origem = lista.findIndex((p) => p.id === arrastadoId)
      const destino = lista.findIndex((p) => p.id === idAlvo)
      if (origem === -1 || destino === -1) return lista
      const nova = [...lista]
      const [item] = nova.splice(origem, 1)
      nova.splice(destino, 0, item)
      return nova
    })
  }

  function aoLargar() {
    setArrastadoId(null)
    const ids = planos.map((p) => p.id)
    reordenarPlanos(ids).then(() => router.refresh())
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      {planos.map((p) => (
        <div
          key={p.id}
          draggable
          onDragStart={() => setArrastadoId(p.id)}
          onDragOver={(e) => {
            e.preventDefault()
            arrastarSobre(p.id)
          }}
          onDragEnd={aoLargar}
          className={`flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface p-3 transition-opacity ${
            arrastadoId === p.id ? 'opacity-40' : ''
          }`}
        >
          <span
            className="shrink-0 cursor-grab text-zinc-400 active:cursor-grabbing"
            title="Arrastar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </span>
          <form action={atualizarPlano} className="flex flex-1 flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={p.id} />
            <select name="servico_id" defaultValue={p.servico_id} title="Serviço do plano" className={`${inputCls} w-44 max-sm:w-full`}>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <input name="nome" defaultValue={p.nome} className={`${inputCls} flex-1 basis-40`} />
            <input
              name="valor"
              type="number"
              step="0.01"
              defaultValue={p.valor}
              className={`${inputCls} w-24`}
            />
            <input
              name="sessoes_por_semana"
              type="number"
              placeholder="sessões/sem"
              title="Frequência semanal, não o total do ciclo — ex.: Express/Premium 4 → 1, 8 → 2, 12 → 3"
              defaultValue={p.sessoes_por_semana ?? ''}
              className={`${inputCls} w-28`}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo
            </label>
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
            >
              Guardar
            </SubmitButton>
          </form>
          <ConfirmarAcao
            action={apagarPlano}
            confirmacao={`Tens a certeza que queres eliminar "${p.nome}"? Esta ação não pode ser desfeita.`}
          >
            <input type="hidden" name="id" value={p.id} />
            <SubmitButton
              pendingText="…"
              aria-label="Eliminar plano"
              className="shrink-0 text-lg text-zinc-400 hover:text-red-600"
            >
              ×
            </SubmitButton>
          </ConfirmarAcao>
        </div>
      ))}
      {planos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
          Ainda não há planos registados.
        </div>
      )}
    </div>
  )
}
