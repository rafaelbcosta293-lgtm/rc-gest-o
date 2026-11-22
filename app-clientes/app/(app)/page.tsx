import Link from 'next/link'
import { CalendarDays, Dumbbell } from 'lucide-react'
import { contaAtual, pedidosEmCurso } from '@/lib/dados'
import { diaPorExtenso, hojeLisboa, instanteAtual, jaPassou } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'

type Proximo = { id: string; data: string; hora: string; titulo: string; detalhe: string; tipo: 'aula' | 'treino' }

const NOMES_PEDIDO: Record<string, string> = {
  inscrever_aula: 'Reserva de aula',
  cancelar_aula: 'Cancelamento de aula',
  desmarcar_treino: 'Desmarcação de treino',
}

export default async function InicioPage() {
  const conta = await contaAtual()
  const agora = instanteAtual()
  const hoje = hojeLisboa(agora)
  const supabase = await criarSupabase()
  const [{ data: treinos }, { data: inscricoes }, pedidos] = await Promise.all([
    supabase.from('treinos').select('id, data, hora_inicio, servico, instrutor, estado').gte('data', hoje).eq('estado', 'Agendado').order('data').order('hora_inicio').limit(10),
    supabase.from('inscricoes').select('estado, aula:aulas(id, data, hora_inicio, servico, instrutor, estado)').neq('estado', 'Cancelada'),
    pedidosEmCurso(),
  ])

  const proximos: Proximo[] = [
    ...(treinos ?? []).map((t) => ({
      id: t.id as string,
      data: t.data as string,
      hora: (t.hora_inicio as string).slice(0, 5),
      titulo: (t.servico as string | null) ?? 'Treino',
      detalhe: t.instrutor ? `com ${t.instrutor}` : '',
      tipo: 'treino' as const,
    })),
    ...(inscricoes ?? []).flatMap((i) => {
      const a = i.aula as unknown as { id: string; data: string; hora_inicio: string; servico: string; instrutor: string | null; estado: string } | null
      if (!a || a.estado !== 'Aberta') return []
      return [{ id: a.id, data: a.data, hora: a.hora_inicio.slice(0, 5), titulo: a.servico, detalhe: a.instrutor ? `com ${a.instrutor}` : '', tipo: 'aula' as const }]
    }),
  ]
    .filter((p) => !jaPassou(p.data, p.hora, agora))
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
    .slice(0, 6)

  const recentes = pedidos.filter((p) => p.estado === 'pendente' || p.estado === 'em_analise' || new Date(p.criado_em).getTime() > agora.getTime() - 86400_000).slice(0, 5)

  return (
    <div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Olá, {conta.nome}!</h1>
      <p className="mt-1 text-sm text-muted">
        {conta.estudio_nome} · nº de cliente <span className="font-mono">{conta.numero}</span>
      </p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Próximos</h2>
      {proximos.length === 0 ? (
        <div className="mt-2 rounded-2xl bg-white p-5 text-sm text-muted shadow-sm ring-1 ring-border">
          Nada marcado.{' '}
          <Link href="/aulas" className="font-semibold text-foreground underline">
            Ver aulas
          </Link>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {proximos.map((p) => (
            <li key={`${p.tipo}-${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.tipo === 'aula' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                {p.tipo === 'aula' ? <CalendarDays className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-muted">
                  {diaPorExtenso(p.data, hoje)} · <span className="tabular-nums text-foreground">{p.hora}</span>
                </p>
                <p className="truncate font-bold">
                  {p.titulo} {p.detalhe && <span className="font-normal text-muted">{p.detalhe}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {recentes.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted">Pedidos</h2>
          <ul className="mt-2 divide-y divide-border rounded-2xl bg-white shadow-sm ring-1 ring-border">
            {recentes.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm">
                <p className="font-semibold">{NOMES_PEDIDO[p.tipo] ?? 'Pedido'}</p>
                <p className={p.estado === 'recusado' ? 'text-red-700' : p.estado === 'aceite' ? 'text-emerald-700' : 'text-muted'}>
                  {p.estado === 'pendente' ? 'A confirmar…' : (p.resposta ?? (p.estado === 'em_analise' ? 'Com a equipa' : p.estado))}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link href="/aulas" className="rounded-2xl bg-zinc-900 p-4 text-white shadow-sm">
          <CalendarDays className="h-6 w-6" />
          <p className="mt-2 font-bold">Reservar aula</p>
        </Link>
        <Link href="/progresso" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
          <Dumbbell className="h-6 w-6" />
          <p className="mt-2 font-bold">Avaliações</p>
        </Link>
      </div>
    </div>
  )
}
