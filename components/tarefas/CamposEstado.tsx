'use client'

import { useState } from 'react'
import { ESTADOS_TAREFA } from '@/lib/data/tarefas'

// O estado no formulário de uma tarefa. Ao escolher "Feito" aparece o
// campo obrigatório "Quem fez" — é esse nome que fica no resumo de quem
// realiza as tarefas.
export default function CamposEstado({
  estadoInicial,
  feitaPorInicial,
  pessoas,
  campoCls,
  rotuloCls,
  compacto = false,
}: {
  estadoInicial: string
  feitaPorInicial: string
  pessoas: { id: string; nome: string }[]
  campoCls: string
  rotuloCls: string
  // Dentro da janela de edição (estreita): sempre a duas colunas.
  compacto?: boolean
}) {
  const [estado, setEstado] = useState(estadoInicial)
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${compacto ? '' : 'lg:grid-cols-4'}`}>
      <label className={rotuloCls}>
        Estado
        <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={campoCls}>
          {ESTADOS_TAREFA.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.rotulo}
            </option>
          ))}
        </select>
      </label>
      {estado === 'feito' && (
        <label className={rotuloCls}>
          Quem fez (obrigatório)
          <select name="feita_por" required defaultValue={feitaPorInicial} className={campoCls}>
            <option value="">Escolher…</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
