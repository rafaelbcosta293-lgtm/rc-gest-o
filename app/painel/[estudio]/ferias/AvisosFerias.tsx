import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import BotaoAvisoVisto from './BotaoAvisoVisto'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// Faixas no topo de qualquer página do estúdio:
//  - ao instrutor, a decisão sobre os seus pedidos (até carregar em OK);
//  - à gestão, quantos pedidos deste estúdio aguardam aprovação.
export default async function AvisosFerias({
  supabase,
  slug,
  estudioId,
  userId,
  ehInstrutor,
  ehGestao,
}: {
  supabase: SupabaseClient
  slug: string
  estudioId: number
  userId: string | null
  ehInstrutor: boolean
  ehGestao: boolean
}) {
  const [{ data: decisoes }, { count: pendentes }] = await Promise.all([
    ehInstrutor && userId
      ? supabase
          .from('pedidos_ferias')
          .select('id, dias, estado, motivo_recusa')
          .eq('perfil_id', userId)
          .neq('estado', 'Pendente')
          .is('aviso_visto_em', null)
          .order('revisto_em')
      : Promise.resolve({ data: [] as { id: string; dias: string[]; estado: string; motivo_recusa: string | null }[] }),
    ehGestao
      ? supabase
          .from('pedidos_ferias')
          .select('id', { count: 'exact', head: true })
          .eq('estudio_id', estudioId)
          .eq('estado', 'Pendente')
      : Promise.resolve({ count: 0 }),
  ])

  if ((decisoes ?? []).length === 0 && !pendentes) return null

  return (
    <div className="flex flex-col">
      {(decisoes ?? []).map((p) => {
        const dias = [...(p.dias as string[])].sort()
        const inicio = dm(dias[0])
        const fim = dm(dias[dias.length - 1])
        const aprovado = p.estado === 'Aprovado'
        return (
          <div
            key={p.id}
            role="status"
            className={`flex items-center gap-3 px-4 py-2 text-sm ${
              aprovado
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <p className="min-w-0 flex-1">
              {aprovado
                ? `O teu pedido de férias (${inicio} a ${fim}) foi aprovado.`
                : `O teu pedido de férias de ${inicio} a ${fim} não foi aprovado pela administração.${p.motivo_recusa ? ` ${p.motivo_recusa}` : ''}`}
            </p>
            <BotaoAvisoVisto pedidoId={p.id} />
          </div>
        )
      })}
      {!!pendentes && (
        <Link
          href={`/painel/${slug}/ferias`}
          className="bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          {pendentes === 1 ? '1 pedido de férias aguarda' : `${pendentes} pedidos de férias aguardam`} a tua aprovação →
        </Link>
      )}
    </div>
  )
}
