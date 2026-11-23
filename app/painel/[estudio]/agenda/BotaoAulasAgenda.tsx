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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 pointer-coarse:px-3.5 pointer-coarse:py-2 pointer-coarse:text-sm ${
        ativo ? 'bg-sky-600 text-white hover:bg-sky-700' : 'border border-border-subtle text-muted hover:bg-brand/[.08]'
      }`}
    >
      <Users className="h-3.5 w-3.5" /> Aulas
    </button>
  )
}
