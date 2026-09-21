import Link from 'next/link'
import { BLOCOS_HORARIO, DIAS_SEMANA } from '@/lib/data/horarios'
import { fmt } from '@/lib/data/presencas'
import SubmitButton from '@/components/SubmitButton'
import type { Perfil } from '@/lib/supabase/database.types'

export type SlotPt = { pt_id: string; nome: string }

export function chaveSlot(data: string, hora: number, minuto: number) {
  return `${data}_${hora}_${minuto}`
}

type PropsComuns = {
  dias: string[]
  slots: Map<string, SlotPt[]>
}

type PropsSoLeitura = PropsComuns & { editavel?: false }

type PropsEditavel = PropsComuns & {
  editavel: true
  pts: Pick<Perfil, 'id' | 'nome'>[]
  estudioSlug: string
  estudioId: number
  semana: string
  editar?: string
  action: (formData: FormData) => void
}

export default function GrelhaHorarios(props: PropsSoLeitura | PropsEditavel) {
  const { dias } = props

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[760px] gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 text-xs dark:border-white/10 dark:bg-white/10"
        style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
      >
        <div className="bg-zinc-50 p-1.5 dark:bg-zinc-900" />
        {dias.map((d, i) => (
          <div
            key={d}
            className="bg-zinc-50 p-1.5 text-center font-medium text-black dark:bg-zinc-900 dark:text-zinc-50"
          >
            {DIAS_SEMANA[i].slice(0, 3)}
            <br />
            <span className="font-normal text-zinc-500">{fmt(d)}</span>
          </div>
        ))}

        {BLOCOS_HORARIO.map((bloco) =>
          props.editavel ? (
            <LinhaEditavel key={`${bloco.hora}-${bloco.minuto}`} bloco={bloco} {...props} />
          ) : (
            <LinhaSoLeitura key={`${bloco.hora}-${bloco.minuto}`} bloco={bloco} {...props} />
          )
        )}
      </div>
    </div>
  )
}

function LinhaSoLeitura({
  bloco,
  dias,
  slots,
}: PropsSoLeitura & { bloco: { hora: number; minuto: number; label: string } }) {
  return (
    <>
      <div className="flex items-center bg-white p-1.5 text-zinc-500 dark:bg-zinc-950">
        {bloco.label}
      </div>
      {dias.map((dia) => {
        const atual = slots.get(chaveSlot(dia, bloco.hora, bloco.minuto)) ?? []
        return (
          <div
            key={dia}
            className="flex min-h-[2.25rem] flex-col justify-center gap-0.5 bg-white p-1 text-[11px] leading-tight dark:bg-zinc-950"
          >
            {atual.length === 0 ? (
              <span className="text-center text-zinc-300 dark:text-zinc-700">—</span>
            ) : (
              atual.map((s) => (
                <span key={s.pt_id} className="truncate text-teal-700 dark:text-teal-400">
                  {s.nome}
                </span>
              ))
            )}
          </div>
        )
      })}
    </>
  )
}

function LinhaEditavel({
  bloco,
  dias,
  slots,
  pts,
  estudioSlug,
  estudioId,
  semana,
  editar,
  action,
}: PropsEditavel & { bloco: { hora: number; minuto: number; label: string } }) {
  return (
    <>
      <div className="flex items-center bg-white p-1.5 text-zinc-500 dark:bg-zinc-950">
        {bloco.label}
      </div>
      {dias.map((dia) => {
        const chave = chaveSlot(dia, bloco.hora, bloco.minuto)
        const atual = slots.get(chave) ?? []
        const aEditar = editar === chave

        if (aEditar) {
          const idsAtuais = new Set(atual.map((s) => s.pt_id))
          return (
            <form
              key={dia}
              action={action}
              className="flex flex-col gap-1 bg-teal-50 p-1.5 dark:bg-teal-950"
            >
              <input type="hidden" name="estudio_slug" value={estudioSlug} />
              <input type="hidden" name="estudio_id" value={estudioId} />
              <input type="hidden" name="semana" value={semana} />
              <input type="hidden" name="data" value={dia} />
              <input type="hidden" name="hora" value={bloco.hora} />
              <input type="hidden" name="minuto" value={bloco.minuto} />
              <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto rounded border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
                {pts.map((p) => (
                  <label key={p.id} className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      name="pt_ids"
                      value={p.id}
                      defaultChecked={idsAtuais.has(p.id)}
                    />
                    <span className="truncate">{p.nome}</span>
                  </label>
                ))}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <SubmitButton
                  pendingText="…"
                  className="rounded bg-foreground px-2 py-0.5 text-[11px] font-medium text-background"
                >
                  Guardar
                </SubmitButton>
                <Link
                  href={`/painel/${estudioSlug}/coordenacao?semana=${semana}`}
                  className="text-[11px] text-zinc-500 underline"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          )
        }

        return (
          <Link
            key={dia}
            href={`/painel/${estudioSlug}/coordenacao?semana=${semana}&editar=${chave}`}
            className="flex min-h-[2.25rem] flex-col justify-center gap-0.5 bg-white p-1 text-[11px] leading-tight hover:bg-black/[.03] dark:bg-zinc-950 dark:hover:bg-white/[.06]"
          >
            {atual.length === 0 ? (
              <span className="text-center text-zinc-300 dark:text-zinc-700">+</span>
            ) : (
              atual.map((s) => (
                <span key={s.pt_id} className="truncate text-teal-700 dark:text-teal-400">
                  {s.nome}
                </span>
              ))
            )}
          </Link>
        )
      })}
    </>
  )
}
