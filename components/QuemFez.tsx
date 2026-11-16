'use client'

import { lembrarQuemFez, useQuemLembrado } from './quemLembrado'

// O campo "quem fez" de um formulário: escolhe-se o nome de quem está a
// fazer (obrigatório). Abre já com o último nome escolhido neste
// aparelho. Numa conta pessoal não aparece: vai em nome dela.
export default function QuemFez({
  pessoas,
  euId,
  rotulo = 'Quem fez',
  campo = 'quem_fez',
  className = 'flex flex-col gap-1 text-xs font-medium text-muted',
  campoCls = 'rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-brand',
}: {
  pessoas: { id: string; nome: string }[]
  euId: string | null
  rotulo?: string
  campo?: string
  className?: string
  campoCls?: string
}) {
  const lembrado = useQuemLembrado()
  if (euId) return <input type="hidden" name={campo} value={euId} />
  // Sem equipa carregada não se obriga a nada (o registo fica sem nome).
  if (pessoas.length === 0) return null
  const valor = pessoas.some((p) => p.id === lembrado) ? lembrado : ''
  return (
    <label className={className}>
      {rotulo}
      <select name={campo} required value={valor} onChange={(e) => lembrarQuemFez(e.target.value)} className={campoCls}>
        <option value="">Escolher…</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
