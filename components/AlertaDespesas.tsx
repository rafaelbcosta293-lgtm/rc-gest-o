import Link from 'next/link'
import { ReceiptText } from 'lucide-react'
import type { AvisoDespesa } from '@/lib/data/despesas'

// Faixa no topo da Administração enquanto houver despesas por pagar cujo
// aviso já disparou (ou que já venceram). Desaparece quando são
// marcadas como pagas.
export default function AlertaDespesas({ avisos }: { avisos: AvisoDespesa[] }) {
  if (avisos.length === 0) return null
  const atrasadas = avisos.filter((a) => a.estado === 'em_atraso').length
  const total = avisos.reduce((s, a) => s + a.valor, 0)
  const nomes = avisos
    .slice(0, 3)
    .map((a) => a.subcategoria ?? a.categoria)
    .join(', ')
  return (
    <Link
      href="/painel/admin/despesas"
      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${
        atrasadas > 0 ? 'bg-red-600 text-white' : 'bg-amber-400 text-black'
      }`}
    >
      <ReceiptText className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {avisos.length} despesa{avisos.length === 1 ? '' : 's'} a pagar (€
        {total.toFixed(2).replace('.', ',')})
        {atrasadas > 0 ? ` · ${atrasadas} em atraso` : ''} — {nomes}
        {avisos.length > 3 ? '…' : ''}
      </span>
      <span className="ml-auto shrink-0 underline">Ver despesas</span>
    </Link>
  )
}
