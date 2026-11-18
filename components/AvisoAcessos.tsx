import type { SupabaseClient } from '@supabase/supabase-js'
import { ShieldAlert } from 'lucide-react'
import Link from '@/components/LinkRapido'
import { marcarAlertasAcessoVistos } from '@/app/painel/alertasAcessoActions'

// Faixa vermelha para a Administração: alguém ganhou acesso a um estúdio,
// mudou de papel ou foi criada uma conta de equipa (ver alertas_acesso,
// preenchida pela base de dados). Só a administração consegue ler estes
// registos (RLS) — para as outras contas a consulta vem vazia e nada
// aparece. Fica até carregar em "Visto".
export default async function AvisoAcessos({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase
    .from('alertas_acesso')
    .select('id, ocorrido_em, descricao')
    .is('visto_em', null)
    .order('ocorrido_em', { ascending: false })
    .limit(5)
  const alertas = (data ?? []) as { id: number; ocorrido_em: string; descricao: string }[]
  if (alertas.length === 0) return null
  const quando = (iso: string) =>
    new Date(iso).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return (
    <div role="alert" className="flex flex-wrap items-start gap-x-3 gap-y-1.5 bg-red-600 px-4 py-2 text-sm font-medium text-white">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Alteração de acessos — confirme que foi intencional:</p>
        <ul className="mt-0.5 space-y-0.5 font-normal">
          {alertas.map((a) => (
            <li key={a.id}>
              {quando(a.ocorrido_em)} · {a.descricao}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/painel/admin/contas" className="underline underline-offset-2">
          Ver equipa
        </Link>
        <form action={marcarAlertasAcessoVistos}>
          {alertas.map((a) => (
            <input key={a.id} type="hidden" name="id" value={a.id} />
          ))}
          <button type="submit" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50">
            Visto
          </button>
        </form>
      </div>
    </div>
  )
}
