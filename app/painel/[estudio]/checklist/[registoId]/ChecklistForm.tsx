'use client'

import { useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export type ItemChecklist = { id: string; item: string; ok: boolean }

// Checklist inteira num só formulário: assinala-se tudo no ecrã (sem
// idas ao servidor a cada visto) e um único "Registar" grava e volta à
// pasta Abertura / Fecho. As secções ficam numa grelha de cartões com a
// mesma largura e a mesma altura por linha (2 colunas; 3 quando o nº de
// secções é múltiplo de 3), para caber num ecrã e ficar alinhado.
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
  const colunasLargas = secoes.length % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <form action={action} onChange={marcarSujo} onSubmit={limparSujo} className="mt-3">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="registo_id" value={registoId} />
      <input type="hidden" name="tipo" value={tipo} />

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${colunasLargas}`}>
        {secoes.map(({ secao, itens }) => {
          const feitosSecao = itens.filter((i) => feitos.has(i.id)).length
          return (
            <section key={secao} className="flex flex-col rounded-xl border border-border-subtle bg-surface">
              <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-1.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{secao}</h2>
                <span className={`text-[11px] font-semibold tabular-nums ${feitosSecao === itens.length ? 'text-teal-700' : 'text-muted'}`}>
                  {feitosSecao}/{itens.length}
                </span>
              </header>
              <ul className="flex flex-1 flex-col px-2 py-1">
                {itens.map((i) => {
                  const ok = feitos.has(i.id)
                  return (
                    <li key={i.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1 text-left text-[13px] leading-snug transition-colors hover:bg-foreground/[.04] ${
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
            </section>
          )
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Ocorrências ou notas de turno (opcional)
          <textarea
            name="ocorrencia"
            rows={2}
            defaultValue={ocorrenciaInicial}
            placeholder={`${ajudaOcorrencias} Ex.: torneira da casa de banho a pingar.`}
            className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-black/30"
          />
        </label>
        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <span className={`text-sm font-semibold tabular-nums ${completos ? 'text-teal-700' : 'text-muted'}`}>
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
