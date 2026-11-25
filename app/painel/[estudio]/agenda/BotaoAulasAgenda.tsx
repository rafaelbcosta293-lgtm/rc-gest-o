'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { COOKIE_AULAS_AGENDA } from '@/lib/data/aulasNaAgenda'

// Mostra/esconde as aulas de grupo na grelha da Agenda. A escolha fica
// guardada neste browser (cookie), para não ter de voltar a escolher.
export default function BotaoAulasAgenda({ ativo }: { ativo: boolean }) {
  const router = useRouter()
  const [aMudar, iniciar] = useTransition()
  return (
    <button
      type="button"
      aria-pressed={ativo}
      disabled={aMudar}
      title={ativo ? 'Esconder as aulas de grupo da Agenda' : 'Mostrar as aulas de grupo na Agenda'}
      onClick={() => {
        document.cookie = `${COOKIE_AULAS_AGENDA}=${ativo ? '0' : '1'}; path=/; max-age=31536000; samesite=lax`
        iniciar(() => router.refresh())
      }}
      className="barra-item"
    >
      <Users className={`h-4 w-4 ${ativo ? 'text-sky-600 dark:text-sky-400' : ''}`} /> Aulas
    </button>
  )
}
