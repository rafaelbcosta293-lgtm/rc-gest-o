import type { SupabaseClient } from '@supabase/supabase-js'
import { Smartphone } from 'lucide-react'
import Link from '@/components/LinkRapido'
import { nomeCurto } from '@/lib/data/clientes'
import { recusarPedidoApp } from '@/app/painel/pedidosAppActions'

// Faixa no topo das páginas do estúdio: pedidos de desmarcação de
// treinos feitos na app do cliente. A equipa desmarca na Agenda (o pedido
// fecha-se sozinho) ou recusa aqui.
export default async function AvisoPedidosApp({ supabase, estudioId, slug }: { supabase: SupabaseClient; estudioId: number; slug: string }) {
  const { data: pedidos } = await supabase
    .from('app_clientes_pedidos')
    .select('id, alvo, nota, criado_em, cliente:clientes(nome, nome_preferido)')
    .eq('estudio_id', estudioId)
    .eq('estado', 'em_analise')
    .order('criado_em')
    .limit(20)
  if (!pedidos || pedidos.length === 0) return null
  const { data: eventos } = await supabase.from('agenda_eventos').select('id, data, hora_inicio').in('id', pedidos.map((p) => p.alvo))
  const ev = new Map((eventos ?? []).map((e) => [e.id as string, e]))
  const quando = (id: string) => {
    const e = ev.get(id)
    if (!e) return 'treino'
    const [, m, d] = (e.data as string).split('-')
    return `treino de ${d}/${m} às ${(e.hora_inicio as string).slice(0, 5)}`
  }

  return (
    <div role="status" className="bg-violet-100 px-4 py-2 text-sm text-violet-950 dark:bg-violet-950 dark:text-violet-100">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">Pedidos de desmarcação na app do cliente</p>
          {pedidos.map((p) => {
            const c = p.cliente as unknown as { nome: string; nome_preferido: string | null } | null
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  <strong>{c ? nomeCurto(c.nome, c.nome_preferido) : 'Cliente'}</strong> quer desmarcar o {quando(p.alvo)}
                  {p.nota && <span className="opacity-80"> — “{p.nota}”</span>}
                </span>
                <Link href={`/painel/${slug}/agenda/${p.alvo}`} className="font-medium underline underline-offset-2">
                  Desmarcar na agenda
                </Link>
                <form action={recusarPedidoApp} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    name="resposta"
                    placeholder="Motivo (opcional)"
                    maxLength={200}
                    className="h-7 w-44 rounded border border-violet-300 bg-white/70 px-2 text-xs text-violet-950 dark:bg-violet-900/50 dark:text-violet-100"
                  />
                  <button className="h-7 rounded border border-violet-400 px-2 text-xs font-semibold hover:bg-violet-200 dark:hover:bg-violet-900">Recusar</button>
                </form>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
