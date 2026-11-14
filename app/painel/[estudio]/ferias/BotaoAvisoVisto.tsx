'use client'

import { usePathname } from 'next/navigation'
import SubmitButton from '@/components/SubmitButton'
import { marcarAvisoFeriasVisto } from './actions'

// Fecha o aviso e volta à mesma página onde a pessoa estava.
export default function BotaoAvisoVisto({ pedidoId }: { pedidoId: string }) {
  const pathname = usePathname()
  return (
    <form action={marcarAvisoFeriasVisto} className="shrink-0">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <input type="hidden" name="voltar_para" value={pathname} />
      <SubmitButton pendingText="…" className="rounded-full border border-current px-3 py-1 text-xs font-semibold">
        OK
      </SubmitButton>
    </form>
  )
}
