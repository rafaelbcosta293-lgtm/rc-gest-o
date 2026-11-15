'use client'

import { usePathname } from 'next/navigation'
import SubmitButton from '@/components/SubmitButton'
import { fecharAvisoHorario } from '@/app/painel/avisosHorarioActions'

// "Ver horário" fecha o aviso e abre o horário dessa semana; "OK" fecha
// o aviso e fica na página onde a pessoa estava.
export default function BotoesAvisoHorario({ estudioId, slug, semana }: { estudioId: number; slug: string; semana: string }) {
  const pathname = usePathname()
  const campos = (
    <>
      <input type="hidden" name="estudio_id" value={estudioId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="semana" value={semana} />
      <input type="hidden" name="voltar_para" value={pathname} />
    </>
  )
  return (
    <div className="flex shrink-0 items-center gap-2">
      <form action={fecharAvisoHorario}>
        {campos}
        <input type="hidden" name="abrir" value="1" />
        <SubmitButton pendingText="…" className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white hover:bg-black/80">
          Ver horário
        </SubmitButton>
      </form>
      <form action={fecharAvisoHorario}>
        {campos}
        <SubmitButton pendingText="…" className="rounded-full border border-current px-3 py-1 text-xs font-semibold">
          OK
        </SubmitButton>
      </form>
    </div>
  )
}
