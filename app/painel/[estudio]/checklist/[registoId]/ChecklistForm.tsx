'use client'

import { useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export type ItemChecklist = { id: string; item: string; ok: boolean }

// Checklist inteira num só formulário: assinala-se tudo no ecrã (sem
// idas ao servidor a cada visto) e um único "Registar" grava e volta à
// pasta Abertura / Fecho. As secções repartem-se por colunas para caber
// tudo num ecrã, sem rolar.
export default function ChecklistForm({
  slug,
  registoId,
  tipo,
  secoes,
  ocorrenciaInicial,
  ajudaOcorrencias,
  action,
}: {
  slug: string
  registoId: string
  tipo: string
  secoes: { secao: string; itens: ItemChecklist[] }[]
  ocorrenciaInicial: string
  ajudaOcorrencias: string
  action: (formData: FormData) => void
}) {
  const { marcarSujo, limparSujo } = useAvisoSairSemGuardar()
  const todos = secoes.flatMap((s) => s.itens)
  const [feitos, setFeitos] = useState(() => new Set(todos.filter((i) => i.ok).map((i) => i.id)))

  function alternar(id: string) {
    setFeitos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
    marcarSujo()
  }

  const total = todos.length
  const completos = feitos.size === total

  return (
    <form action={action} onChange={marcarSujo} onSubmit={limparSujo} className="mt-3">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="registo_id" value={registoId} />
      <input type="hidden" name="tipo" value={tipo} />

      <div className="gap-x-4 sm:columns-2 xl:columns-3">
        {secoes.map(({ secao, itens }) => (
          <fieldset key={secao} className="mb-3 break-inside-avoid rounded-xl border border-border-subtle bg-surface px-3 py-2">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{secao}</legend>
            <ul className="flex flex-col">
              {itens.map((i) => {
                const ok = feitos.has(i.id)
                return (
                  <li key={i.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-left text-[13px] leading-snug transition-colors hover:bg-foreground/[.04] ${
                        ok ? 'text-teal-800' : 'text-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="ok"
                        value={i.id}
                        checked={ok}
                        onChange={() => alternar(i.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
                      />
                      <span>{i.item}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Ocorrências ou notas de turno (opcional)
          <textarea
            name="ocorrencia"
            rows={2}
            defaultValue={ocorrenciaInicial}
            placeholder={`${ajudaOcorrencias} Ex.: torneira da casa de banho a pingar.`}
            className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-black/30"
          />
        </label>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${completos ? 'text-teal-700' : 'text-muted'}`}>
            {feitos.size} de {total} feitos
          </span>
          <SubmitButton
            pendingText="A registar…"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-black hover:bg-brand-strong"
          >
            Registar {tipo.toLowerCase()}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
