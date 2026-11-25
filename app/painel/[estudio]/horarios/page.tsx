import Link from '@/components/LinkRapido'
import { Barra, BarraPeriodo } from '@/components/Barra'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEstudios, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederEstudio } from '@/lib/data/acessos'
import { intervaloCurto } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias, chaveSlot } from '@/lib/data/horarios'
import { coresInstrutores, corEstudio } from '@/lib/data/constantes'
import GrelhaHorarios, { type SlotPt, type CorPt } from '@/components/GrelhaHorarios'
import { hojeEmLisboa } from '@/lib/data/hoje'

export default async function HorariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ semana?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { semana: semanaParam, error } = await searchParams
  const hoje = hojeEmLisboa()
  const inicio = inicioDaSemana(semanaParam ?? hoje)
  const dias = diasDaSemana(inicio)
  const fimExclusivo = somarDias(inicio, 7)
  const semanaAnterior = somarDias(inicio, -7)
  const semanaSeguinte = somarDias(inicio, 7)

  const supabase = await createClient()
  const [estudio, sessao, todosEstudios] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    getSessaoAtual(),
    getEstudios(supabase),
  ])
  if (!estudio) {
    notFound()
  }

  // Horário comum: além do estúdio aberto, mostram-se os outros estúdios
  // a que esta conta tem acesso — quem trabalha em Fátima e em Leiria vê
  // as duas escalas na mesma página, tal como a Coordenação. Uma conta
  // de estúdio (RC Fátima, RC Leiria) continua a ver só o seu.
  const { data: ligacoes } = sessao.userId
    ? await supabase.from('perfis_estudios').select('estudio_id').eq('perfil_id', sessao.userId)
    : { data: [] as { estudio_id: number }[] }
  const ligados = new Set((ligacoes ?? []).map((l) => l.estudio_id))
  const estudios = [
    estudio,
    ...todosEstudios.filter((e) => e.id !== estudio.id && (podeAcederEstudio(sessao.email, e.slug) || ligados.has(e.id))),
  ]

  const [{ data: turnosData, error: erroTurnos }, ...equipas] = await Promise.all([
    supabase
      .from('escalas')
      .select('estudio_id, data, hora, minuto, pt:perfis!pt_id(id, nome)')
      .in(
        'estudio_id',
        estudios.map((e) => e.id)
      )
      .gte('data', inicio)
      .lt('data', fimExclusivo)
      .order('criado_em'),
    ...estudios.map((e) => getEquipaDoEstudio(supabase, e.id)),
  ])

  if (erroTurnos) {
    throw new Error(erroTurnos.message)
  }

  // Mesma cor por instrutor que aparece em Coordenação (ver
  // coresInstrutores), igual nos dois estúdios, para se reconhecer quem
  // é quem.
  const pessoas = [...new Map(equipas.flat().map((p) => [p.id, p])).values()].sort((a, b) => a.nome.localeCompare(b.nome))
  const cores = coresInstrutores(pessoas.map((p) => p.nome))
  const corPorPt: Record<string, CorPt> = Object.fromEntries(pessoas.map((p, i) => [p.id, cores[i]]))

  // Objeto simples (não Map) porque isto atravessa a fronteira
  // servidor → cliente como propriedade de GrelhaHorarios.
  const slotsPorEstudio = new Map<number, Record<string, SlotPt[]>>(estudios.map((e) => [e.id, {}]))
  for (const t of (turnosData ?? []) as unknown as {
    estudio_id: number
    data: string
    hora: number
    minuto: number
    pt: { id: string; nome: string } | null
  }[]) {
    const slots = slotsPorEstudio.get(t.estudio_id)
    if (!t.pt || !slots) continue
    const chave = chaveSlot(t.data, t.hora, t.minuto)
    const lista = slots[chave] ?? []
    lista.push({ pt_id: t.pt.id, nome: t.pt.nome })
    slots[chave] = lista
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Horários</h1>
      <p className="mt-1 text-sm text-muted">
        {estudios.map((e) => e.nome).join(' e ')} · quem está em cada estúdio, a cada hora da semana.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Barra rotulo="Semana" className="mt-5 w-fit max-w-full">
        <BarraPeriodo
          anterior={`/painel/${slug}/horarios?semana=${semanaAnterior}`}
          seguinte={`/painel/${slug}/horarios?semana=${semanaSeguinte}`}
          titulo={intervaloCurto(dias[0], dias[6])}
          largura="17ch"
          hoje={`/painel/${slug}/horarios`}
          noPeriodoDeHoje={hoje >= dias[0] && hoje <= dias[6]}
        />
      </Barra>
      <p className="mt-2 text-xs text-muted">
        Só para consulta — a escala é planeada em Coordenação.
      </p>

      <div className="mt-4 flex flex-col gap-y-8">
        {estudios.map((e) => (
          <section key={e.id}>
            {estudios.length > 1 && (
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corEstudio(e.slug).cor }} />
                <h2 className="text-lg font-semibold text-foreground">{e.nome}</h2>
              </div>
            )}
            <GrelhaHorarios dias={dias} slots={slotsPorEstudio.get(e.id) ?? {}} corPorPt={corPorPt} />
          </section>
        ))}
      </div>
    </div>
  )
}
