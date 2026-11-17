'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fecharDiaNaAgenda, reabrirDiaNaAgenda } from './actions'

// Botão ao lado de um feriado na Agenda: fecha o estúdio nesse dia (a
// Agenda deixa de aceitar treinos para lá) ou volta a abri-lo.
export default function FecharDia({
  estudioSlug,
  estudioId,
  data,
  motivo,
  fechado,
}: {
  estudioSlug: string
  estudioId: number
  data: string
  motivo: string
  fechado: boolean
}) {
  const router = useRouter()
  const [aGravar, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function alternar() {
    setErro(null)
    iniciar(async () => {
      const r = fechado
        ? await reabrirDiaNaAgenda({ estudioSlug, estudioId, data })
        : await fecharDiaNaAgenda({ estudioSlug, estudioId, data, motivo })
      if ('error' in r) setErro(r.error)
      else router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        disabled={aGravar}
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
          fechado
            ? 'border border-amber-600/40 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950'
            : 'bg-amber-600 text-white hover:bg-amber-700'
        }`}
      >
        {aGravar ? 'A gravar…' : fechado ? 'Reabrir o dia' : 'Fechar o estúdio neste dia'}
      </button>
      {erro && <span className="text-red-700 dark:text-red-300">{erro}</span>}
    </>
  )
}
