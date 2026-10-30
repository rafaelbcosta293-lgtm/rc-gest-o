'use client'

import { Printer } from 'lucide-react'

// "Relatório mensal... PDF ou ecrã" (secção 7) — usa a função de
// imprimir do próprio browser (Guardar como PDF já está em qualquer
// impressora do sistema), sem precisar de nenhuma biblioteca de PDF.
export default function ImprimirButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-foreground/[.06]"
    >
      <Printer className="h-4 w-4" /> Imprimir / Exportar PDF
    </button>
  )
}
