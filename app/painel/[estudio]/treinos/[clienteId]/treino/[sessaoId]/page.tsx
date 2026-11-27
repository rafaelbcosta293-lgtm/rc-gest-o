import Link from '@/components/LinkRapido'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getCatalogoExercicios } from '@/lib/data/catalogo'
import type { ItemCatalogo } from '@/lib/data/catalogo'
import { associarTreino, registarTreino } from '../actions'
import { rotuloTreinoMarcado, treinosMarcadosDoCliente } from '@/lib/data/controloInstrutoresDados'
import SubmitButton from '@/components/SubmitButton'
import TreinoForm, { type LinhaExercicio } from '../../../TreinoForm'
import type { BlocoTipo } from '@/lib/data/constantes'
import { ArrowLeft, CalendarCheck, CalendarX } from 'lucide-react'

type SessaoHistorico = {
  data: string
  sessao_exercicios: {
    exercicio_id: string | null
    series: string | null
    reps: string | null
    carga: string | null
    descanso: string | null
  }[]
}

export default async function EditarTreinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string; sessaoId: string }>
  searchParams: Promise<{ error?: string; ok?: string }>
}) {
  const { estudio: slug, clienteId, sessaoId } = await params
  const { error, ok } = await searchParams
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())

  const supabase = await createClient()
  const [
    estudio,
    { data: cliente },
    { data: sessao },
    catalogo,
    { data: exerciciosSessao },
    { data: historicoData },
  ] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('id, nome, estudio_id').eq('id', clienteId).maybeSingle(),
    supabase
      .from('sessoes')
      .select('*')
      .eq('id', sessaoId)
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    getCatalogoExercicios(supabase),
    supabase.from('sessao_exercicios').select('*').eq('sessao_id', sessaoId).order('ordem'),
    // Últimos treinos deste cliente (à parte), para sugerir os
    // exercícios mais usados e pré-preencher séries/reps/carga/descanso
    // com o que ficou registado da última vez que fez o mesmo exercício.
    supabase
      .from('sessoes')
      .select('data, sessao_exercicios(exercicio_id, series, reps, carga, descanso)')
      .eq('cliente_id', clienteId)
      .neq('id', sessaoId)
      .order('data', { ascending: false })
      .limit(20),
  ])

  if (!estudio || !cliente || !sessao || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  // O treino da Agenda a que este plano está ligado (pode ser mais
  // antigo do que a lista dos treinos próximos) e os outros treinos do
  // cliente a que se pode associar.
  const [pts, treinosMarcados, { data: eventoLigado }] = await Promise.all([
    getEquipaDoEstudio(supabase, estudio.id, sessao.pt_id),
    treinosMarcadosDoCliente(supabase, clienteId, hoje),
    sessao.agenda_evento_id
      ? supabase.from('agenda_eventos').select('id, data, hora_inicio, estado, pt:perfis!pt_id(nome)').eq('id', sessao.agenda_evento_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const treinoLigado = eventoLigado as unknown as {
    id: string
    data: string
    hora_inicio: string
    estado: string
    pt: { nome: string } | null
  } | null
  const outrosTreinos = treinosMarcados.filter((t) => !t.planoId)

  const historico = (historicoData ?? []) as unknown as SessaoHistorico[]
  const ultimosValores: Record<
    string,
    { series: string; reps: string; carga: string; descanso: string }
  > = {}
  const contagem = new Map<string, number>()
  for (const sessaoAnterior of historico) {
    for (const ex of sessaoAnterior.sessao_exercicios ?? []) {
      if (!ex.exercicio_id) continue
      contagem.set(ex.exercicio_id, (contagem.get(ex.exercicio_id) ?? 0) + 1)
      if (!ultimosValores[ex.exercicio_id]) {
        ultimosValores[ex.exercicio_id] = {
          series: ex.series ?? '',
          reps: ex.reps ?? '',
          carga: ex.carga ?? '',
          descanso: ex.descanso ?? '',
        }
      }
    }
  }
  // O último plano com exercícios, anterior a este (ou do mesmo dia):
  // é o que "Copiar plano anterior" vai buscar.
  const anterior = historico.find((h) => h.data <= sessao.data && (h.sessao_exercicios ?? []).length > 0)
  const planoAnterior = anterior ? { data: anterior.data } : null
  const maisUsados = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => catalogo.todos.find((e) => e.id === id))
    .filter((e): e is ItemCatalogo => !!e)

  const exercicios: LinhaExercicio[] = (exerciciosSessao ?? []).map((e) => ({
    key: e.id,
    id: e.id,
    bloco: e.bloco as BlocoTipo,
    exercicio_id: e.exercicio_id,
    exercicio_nome: e.exercicio_nome,
    series: e.series ?? '',
    reps: e.reps ?? '',
    carga: e.carga ?? '',
    descanso: e.descanso ?? '',
    nota: e.nota ?? '',
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/painel/${slug}/treinos/${clienteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {cliente.nome}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        {sessao.correu ? 'Treino' : sessao.data > hoje ? 'Planear treino' : 'Treino de hoje'}
      </h1>
      <p className="mt-1 text-sm text-muted">{cliente.nome}</p>

      {/* A que treino da Agenda pertence este plano. */}
      <div
        className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm ${
          treinoLigado && treinoLigado.estado !== 'Cancelado'
            ? 'border-border-subtle text-foreground'
            : 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        }`}
      >
        {treinoLigado ? (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            Treino na Agenda: {rotuloTreinoMarcado({ data: treinoLigado.data, hora_inicio: treinoLigado.hora_inicio, instrutor: treinoLigado.pt?.nome ?? null })}
            {treinoLigado.estado === 'Cancelado' && ' — desmarcado'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CalendarX className="h-4 w-4 shrink-0" />
            Este plano não está associado a nenhum treino da Agenda.
          </span>
        )}
        {outrosTreinos.length > 0 && (
          <details className="ml-auto">
            <summary className="cursor-pointer text-xs font-semibold underline underline-offset-2">
              {treinoLigado ? 'Mudar de treino' : 'Associar a um treino'}
            </summary>
            <form action={associarTreino} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="cliente_id" value={clienteId} />
              <input type="hidden" name="id" value={sessao.id} />
              <select
                name="agenda_evento_id"
                required
                defaultValue=""
                aria-label="Treino da Agenda"
                className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground pointer-coarse:py-2.5"
              >
                <option value="">— Escolher treino —</option>
                {outrosTreinos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {rotuloTreinoMarcado(t)}
                  </option>
                ))}
              </select>
              <SubmitButton
                pendingText="A associar…"
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/[.08] pointer-coarse:py-2.5"
              >
                Associar
              </SubmitButton>
            </form>
          </details>
        )}
      </div>

      <TreinoForm
        estudioSlug={slug}
        clienteId={clienteId}
        pts={pts}
        catalogo={catalogo}
        ultimosValores={ultimosValores}
        maisUsados={maisUsados}
        inicial={{
          id: sessao.id,
          data: sessao.data,
          pt_id: sessao.pt_id,
          foco: sessao.foco,
          tipo_treino: sessao.tipo_treino,
          correu: sessao.correu,
          tipo_nota: sessao.tipo_nota,
          nota_proxima: sessao.nota_proxima,
          exercicios,
          dataFixa: !!sessao.agenda_evento_id,
        }}
        hoje={hoje}
        planoAnterior={planoAnterior}
        acaoRegisto={registarTreino}
        error={error}
        ok={ok}
      />
    </div>
  )
}
