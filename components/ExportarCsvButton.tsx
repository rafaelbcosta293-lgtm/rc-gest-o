'use client'

import { Download } from 'lucide-react'
import { gerarCsv } from '@/lib/data/csv'

// Botão reutilizável para "exportação de qualquer tabela" (secção 7)
// — gera o ficheiro no browser a partir dos dados já na página, sem
// pedido novo ao servidor.
export default function ExportarCsvButton({
  colunas,
  linhas,
  nomeFicheiro,
  className,
}: {
  colunas: { chave: string; label: string }[]
  linhas: Record<string, unknown>[]
  nomeFicheiro: string
  className?: string
}) {
  function exportar() {
    const csv = gerarCsv(colunas, linhas)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeFicheiro.endsWith('.csv') ? nomeFicheiro : `${nomeFicheiro}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={linhas.length === 0}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/[.08]'
      }
    >
      <Download className="h-4 w-4" /> Exportar CSV
    </button>
  )
}
