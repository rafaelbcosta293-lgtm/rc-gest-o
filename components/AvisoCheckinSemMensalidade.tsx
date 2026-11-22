import type { SupabaseClient } from '@supabase/supabase-js'
import { Wallet } from 'lucide-react'
import Link from '@/components/LinkRapido'
import { carregarCheckinsSemMensalidade } from '@/lib/data/checkinSemMensalidade'

// Faixa no topo das páginas do estúdio: quem tentou hoje fazer check-in no
// tablet sem a mensalidade em dia (a presença não ficou registada). Some
// sozinha quando o pagamento é registado.
export default async function AvisoCheckinSemMensalidade({
  supabase,
  estudioId,
  slug,
}: {
  supabase: SupabaseClient
  estudioId: number
  slug: string
}) {
  const lista = await carregarCheckinsSemMensalidade(supabase, estudioId)
  if (lista.length === 0) return null
  return (
    <div role="status" className="flex flex-wrap items-start gap-x-3 gap-y-1 bg-sky-100 px-4 py-2 text-sm text-sky-950 dark:bg-sky-950 dark:text-sky-100">
      <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Check-in recusado por mensalidade em falta: </span>
        {lista.map((c, i) => (
          <span key={c.clienteId}>
            {i > 0 && ' · '}
            <Link href={`/painel/${slug}/pagamentos/${c.clienteId}`} className="font-medium underline underline-offset-2">
              {c.nome}
            </Link>{' '}
            <span className="opacity-75">({c.horas.join(', ')})</span>
          </span>
        ))}
        <span className="opacity-75"> — clique no nome para registar o pagamento.</span>
      </p>
    </div>
  )
}
