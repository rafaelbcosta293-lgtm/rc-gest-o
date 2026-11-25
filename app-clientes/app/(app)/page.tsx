import Link from 'next/link'
import { ArrowRight, CalendarPlus, ChevronRight, Clock, MonitorPlay, UserRound } from 'lucide-react'
import { BlocoData, Cartao, Etiqueta, Seccao, type Tom } from '@/components/ui'
import { contaAtual, pedidosEmCurso, totalAulasVirtuais } from '@/lib/dados'
import { diaLongo, diaPorExtenso, hojeLisboa, instanteAtual, jaPassou } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { plural } from '@/lib/vistas'

type Marcacao = { id: string; data: string; hora: string; duracao: number; titulo: string; instrutor: string | null; tipo: 'aula' | 'treino' }

const PEDIDO: Record<string, string> = {
  inscrever_aula: 'Reserva de aula',
  cancelar_aula: 'Cancelamento de aula',
  desmarcar_treino: 'Desmarcação de treino',
}
const ESTADO_PEDIDO: Record<string, { texto: string; tom: Tom }> = {
  pendente: { texto: 'A confirmar', tom: 'espera' },
  em_analise: { texto: 'Com a equipa', tom: 'espera' },
  aceite: { texto: 'Confirmado', tom: 'ok' },
  recusado: { texto: 'Recusado', tom: 'erro' },
}

export default async function InicioPage() {
  const conta = await contaAtual()
  const agora = instanteAtual()
  const hoje = hojeLisboa(agora)
  const supabase = await criarSupabase()
  const [{ data: treinos }, { data: inscricoes }, { count: presencasMes }, pedidos, totalVideos] = await Promise.all([
    supabase.from('treinos').select('id, data, hora_inicio, duracao_min, servico, instrutor').gte('data', hoje).eq('estado', 'Agendado').order('data').order('hora_inicio').limit(20),
    supabase.from('inscricoes').select('estado, aula:aulas(id, data, hora_inicio, duracao_min, servico, instrutor, estado)').neq('estado', 'Cancelada'),
    supabase.from('presencas').select('id', { count: 'exact', head: true }).eq('estado', 'Presente').gte('data', `${hoje.slice(0, 7)}-01`),
    pedidosEmCurso(),
    totalAulasVirtuais(),
  ])

  const marcacoes: Marcacao[] = [
    ...(treinos ?? []).map((t) => ({
      id: t.id as string,
      data: t.data as string,
      hora: (t.hora_inicio as string).slice(0, 5),
      duracao: t.duracao_min as number,
      titulo: (t.servico as string | null) ?? 'Treino',
      instrutor: t.instrutor as string | null,
      tipo: 'treino' as const,
    })),
    ...(inscricoes ?? []).flatMap((i) => {
      const a = i.aula as unknown as { id: string; data: string; hora_inicio: string; duracao_min: number; servico: string; instrutor: string | null; estado: string } | null
      if (!a || a.estado !== 'Aberta') return []
      return [{ id: a.id, data: a.data, hora: a.hora_inicio.slice(0, 5), duracao: a.duracao_min, titulo: a.servico, instrutor: a.instrutor, tipo: 'aula' as const }]
    }),
  ]
    .filter((m) => !jaPassou(m.data, m.hora, agora))
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))

  const [proxima, ...resto] = marcacoes
  const aSeguir = resto.slice(0, 4)
  const recentes = pedidos
    .filter((p) => p.estado === 'pendente' || p.estado === 'em_analise' || new Date(p.criado_em).getTime() > agora.getTime() - 86400_000)
    .slice(0, 3)

  return (
    <div>
      <header className="pt-3">
        <p className="text-sm text-muted first-letter:uppercase">{diaLongo(hoje)}</p>
        <h1 className="mt-0.5 text-[1.7rem] leading-tight font-bold tracking-tight">Olá, {conta.nome}</h1>
      </header>

      {/* Próxima sessão — o que mais interessa ao abrir a app */}
      {proxima ? (
        <Link
          href={proxima.tipo === 'aula' ? '/aulas' : '/treinos'}
          className="mt-5 block rounded-3xl bg-zinc-900 p-5 text-white shadow-lg shadow-zinc-900/10 active:scale-[.99]"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-[0.1em] text-brand uppercase">Próxima sessão</p>
            <ArrowRight className="h-4 w-4 text-zinc-500" />
          </div>
          <p className="mt-3 text-[0.95rem] text-zinc-300 first-letter:uppercase">{diaPorExtenso(proxima.data, hoje)}</p>
          <p className="mt-0.5 text-[2.6rem] leading-none font-bold tracking-tight tabular-nums">{proxima.hora}</p>
          <p className="mt-3 text-lg leading-snug font-semibold">{proxima.titulo}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-zinc-500" /> {proxima.duracao} min
            </span>
            {proxima.instrutor && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4 text-zinc-500" /> {proxima.instrutor}
              </span>
            )}
          </div>
        </Link>
      ) : (
        <div className="mt-5 rounded-3xl bg-zinc-900 p-5 text-white shadow-lg shadow-zinc-900/10">
          <p className="text-xs font-semibold tracking-[0.1em] text-brand uppercase">Próxima sessão</p>
          <p className="mt-3 text-lg leading-snug font-semibold">Ainda não tem nada marcado</p>
          <p className="mt-1 text-sm leading-snug text-zinc-300">Reserve um lugar numa aula de grupo ou fale com o seu treinador.</p>
          <Link href="/aulas" className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-zinc-900 active:bg-brand-strong">
            <CalendarPlus className="h-4 w-4" /> Ver aulas
          </Link>
        </div>
      )}

      {/* Resumo */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/progresso" className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border active:bg-soft">
          <p className="text-[1.7rem] leading-none font-bold tabular-nums">{presencasMes ?? 0}</p>
          <p className="mt-1.5 text-sm leading-tight text-muted">{(presencasMes ?? 0) === 1 ? 'presença este mês' : 'presenças este mês'}</p>
        </Link>
        <Link href="/treinos" className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border active:bg-soft">
          <p className="text-[1.7rem] leading-none font-bold tabular-nums">{marcacoes.length}</p>
          <p className="mt-1.5 text-sm leading-tight text-muted">{marcacoes.length === 1 ? 'sessão marcada' : 'sessões marcadas'}</p>
        </Link>
      </div>

      {/* Aulas virtuais: atalho para quem tem o serviço; aos outros dá-se a
          conhecer (só quando já há aulas publicadas). */}
      {(conta.aulas_virtuais || totalVideos > 0) && (
        <Link href="/videos" className="mt-3 flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border active:bg-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-brand">
            <MonitorPlay className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-semibold">
              Aulas virtuais
              {!conta.aulas_virtuais && <Etiqueta tom="info">Novo</Etiqueta>}
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-muted">
              {conta.aulas_virtuais
                ? totalVideos > 0
                  ? `${plural(totalVideos, 'aula em vídeo', 'aulas em vídeo')} para fazer quando quiser`
                  : 'Aulas em vídeo para fazer quando quiser'
                : 'Treine em casa com aulas em vídeo — saiba como aderir'}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300" />
        </Link>
      )}

      {aSeguir.length > 0 && (
        <Seccao
          titulo="A seguir"
          acao={
            resto.length > aSeguir.length ? (
              <span className="text-xs text-muted">mais {plural(resto.length - aSeguir.length, 'marcação', 'marcações')}</span>
            ) : undefined
          }
        >
          <Cartao className="divide-y divide-border">
            {aSeguir.map((m) => (
              <Link key={`${m.tipo}-${m.id}`} href={m.tipo === 'aula' ? '/aulas' : '/treinos'} className="flex items-center gap-3.5 px-4 py-3 active:bg-soft">
                <BlocoData dia={m.data} destaque={m.data === hoje} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.titulo}</p>
                  <p className="text-sm text-muted">
                    <span className="font-medium text-foreground tabular-nums">{m.hora}</span>
                    {m.instrutor ? ` · ${m.instrutor}` : ''}
                    {m.tipo === 'aula' ? ' · aula de grupo' : ''}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300" />
              </Link>
            ))}
          </Cartao>
        </Seccao>
      )}

      {recentes.length > 0 && (
        <Seccao titulo="Pedidos recentes">
          <Cartao className="divide-y divide-border">
            {recentes.map((p) => {
              const e = ESTADO_PEDIDO[p.estado] ?? ESTADO_PEDIDO.pendente
              return (
                <div key={p.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{PEDIDO[p.tipo] ?? 'Pedido'}</p>
                    <Etiqueta tom={e.tom}>{e.texto}</Etiqueta>
                  </div>
                  {p.resposta && p.estado === 'recusado' && <p className="mt-1 text-sm leading-snug text-muted">{p.resposta}</p>}
                </div>
              )
            })}
          </Cartao>
        </Seccao>
      )}

      <Link
        href="/aulas"
        className="mt-7 flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border active:bg-soft"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/25 text-brand-ink">
          <CalendarPlus className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Reservar uma aula de grupo</span>
          <span className="block text-sm text-muted">Veja os horários e as vagas em {conta.estudio_nome}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300" />
      </Link>
    </div>
  )
}
