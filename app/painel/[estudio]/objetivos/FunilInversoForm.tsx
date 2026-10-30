'use client'

import { useState } from 'react'
import { calcularFunilInverso } from '@/lib/data/objetivos'

export default function FunilInversoForm({
  funil,
  contactosRecentes,
}: {
  funil: { total: number; porEtapa: Record<string, number> }
  contactosRecentes: number
}) {
  const [desejados, setDesejados] = useState(5)
  const resultado = calcularFunilInverso(desejados, funil, contactosRecentes)

  return (
    <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
      <label className="flex items-center gap-3 text-sm text-foreground">
        Quero
        <input
          type="number"
          min={1}
          value={desejados}
          onChange={(e) => setDesejados(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-border-subtle px-2 py-1 text-center text-sm dark:bg-zinc-900"
        />
        clientes novos este mês
      </label>

      {funil.total === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Sem leads suficientes nos últimos 90 dias para calcular taxas reais.
        </p>
      ) : resultado.leadsNecessarias == null ? (
        <p className="mt-3 text-sm text-muted">
          Ainda não houve nenhuma conversão (lead → cliente) nos últimos 90 dias — sem essa taxa não
          há como calcular quantas leads seriam precisas.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-xl tabular-nums text-foreground">{resultado.leadsNecessarias}</p>
            <p className="text-xs text-muted">leads</p>
          </div>
          <div>
            <p className="font-mono text-xl tabular-nums text-foreground">
              {resultado.contactosNecessarios}
            </p>
            <p className="text-xs text-muted">contactos</p>
          </div>
          <div>
            <p className="font-mono text-xl tabular-nums text-foreground">
              {resultado.experimentaisNecessarias}
            </p>
            <p className="text-xs text-muted">experimentais</p>
          </div>
        </div>
      )}
    </div>
  )
}
