'use client'

import { useState } from 'react'
import { DIAS_DA_SEMANA, REPETICOES_TAREFA } from '@/lib/data/tarefas'

// Os campos da repetição no formulário de uma tarefa. Mostra só o que
// faz sentido para a forma escolhida (os dias da semana, o "de quantos
// em quantos", os dias depois de concluir) e a data em que acaba.
export default function CamposRepeticao({
  inicial,
  campoCls,
  rotuloCls,
}: {
  inicial: {
    escolha: string
    dias: number[]
    intervalo: number
    aposDias: number | null
    ate: string | null
  }
  campoCls: string
  rotuloCls: string
}) {
  const [escolha, setEscolha] = useState(inicial.escolha)
  const unidade = escolha === 'dias' ? 'semanas' : escolha === 'anual' ? 'anos' : 'meses'
  const comIntervalo = escolha === 'dias' || escolha === 'mensal' || escolha === 'mensal-semana' || escolha === 'anual'

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <label className={`${rotuloCls} col-span-2`}>
          Repetir
          <select name="repeticao" value={escolha} onChange={(e) => setEscolha(e.target.value)} className={campoCls}>
            {REPETICOES_TAREFA.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
        </label>
        {comIntervalo && (
          <label className={rotuloCls}>
            De quantas em quantas {unidade}
            <input type="number" name="repete_intervalo" min={1} max={52} defaultValue={inicial.intervalo} className={campoCls} />
          </label>
        )}
        {escolha === 'apos' && (
          <label className={rotuloCls}>
            Dias depois de concluir
            <input type="number" name="repete_apos_dias" min={1} max={365} defaultValue={inicial.aposDias ?? 7} className={campoCls} />
          </label>
        )}
        {escolha !== 'nao' && (
          <label className={rotuloCls}>
            Repetir até (opcional)
            <input type="date" name="repete_ate" defaultValue={inicial.ate ?? ''} className={campoCls} />
          </label>
        )}
      </div>
      {escolha === 'dias' && (
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <legend className="sr-only">Dias da semana</legend>
          {DIAS_DA_SEMANA.map((d) => (
            <label key={d.valor} className="flex items-center gap-1.5 text-sm text-foreground">
              <input type="checkbox" name="dia" value={d.valor} defaultChecked={inicial.dias.includes(d.valor)} className="h-4 w-4" />
              {d.curto}
            </label>
          ))}
        </fieldset>
      )}
      {escolha !== 'nao' && (
        <p className="text-xs text-muted">
          {escolha === 'mensal-semana' ? 'Repete no mesmo dia da semana do prazo (ex.: prazo na 1.ª segunda-feira → todas as 1.ªs segundas). ' : ''}
          Quando a tarefa é concluída, nasce a seguinte com o próximo prazo.
        </p>
      )}
    </div>
  )
}
