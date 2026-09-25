import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios, getEquipaDoEstudio } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias, chaveSlot } from '@/lib/data/horarios'
import { guardarSemana, criarInstrutor, desbloquearCoordenacao } from '../actions'
import { alternarAcesso } from '../../[estudio]/equipa/actions'
import { corInstrutor, corEstudio } from '@/lib/data/constantes'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import PortaSenha from '@/components/PortaSenha'
import GrelhaHorarios, { type SlotPt, type CorPt } from '@/components/GrelhaHorarios'
import type { Estudio, Perfil } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

type TurnoSemana = { data: string; hora: number; minuto: number; pt: { id: string; nome: string } | null }
type SP = Record<string, string | undefined>

// Cada estúdio navega a sua própria semana nesta página combinada, sem
// mexer na do outro — os parâmetros vêm prefixados com o slug
// ("fatima_semana", "leiria_semana") e comQuery preserva tudo o resto.
function comQuery(sp: SP, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined) params.set(k, v)
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function HorariosCoordenacaoPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const { error, erroSenha } = sp

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação"
        destino="/painel/coordenacao/horarios"
        action={desbloquearCoordenacao}
        erro={erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/painel/coordenacao" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Coordenação
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Planeamento da semana
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudios.map((e) => e.nome).join(' e ')} · escala e instrutores, lado a lado.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        {estudios.map((estudio) => (
          <section key={estudio.id}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: corEstudio(estudio.slug).cor }}
              />
              <h2 className="text-lg font-semibold text-black dark:text-zinc-50">{estudio.nome}</h2>
            </div>
            <PainelHorariosEstudio estudio={estudio} sp={sp} />
          </section>
        ))}
      </div>
    </div>
  )
}

async function PainelHorariosEstudio({
  estudio,
  sp,
}: {
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>
  sp: SP
}) {
  const slug = estudio.slug
  const pk = (nome: string) => `${slug}_${nome}`
  const hoje = new Date().toISOString().slice(0, 10)
  const semanaParam = sp[pk('semana')]
  const inicioSemana = inicioDaSemana(semanaParam ?? hoje)
  const diasSemana = diasDaSemana(inicioSemana)
  const fimSemanaExclusivo = somarDias(inicioSemana, 7)
  const semanaAnterior = somarDias(inicioSemana, -7)
  const semanaSeguinte = somarDias(inicioSemana, 7)

  const supabase = await createClient()

  const [
    { data: escalaSemanaData, error: erroEscala },
    listaPts,
    { data: perfisData },
  ] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt:perfis!pt_id(id, nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicioSemana)
      .lt('data', fimSemanaExclusivo)
      .order('criado_em'),
    getEquipaDoEstudio(supabase, estudio.id),
    supabase.from('perfis').select('id, nome, papel, ativo').order('nome'),
  ])

  if (erroEscala) {
    throw new Error(erroEscala.message)
  }

  const escalaSemana = (escalaSemanaData ?? []) as unknown as TurnoSemana[]

  // Objeto simples (não Map) porque isto atravessa a fronteira
  // servidor → cliente como propriedade de GrelhaHorarios.
  const slots: Record<string, SlotPt[]> = {}
  for (const t of escalaSemana) {
    if (!t.pt) continue
    const chave = chaveSlot(t.data, t.hora, t.minuto)
    const lista = slots[chave] ?? []
    lista.push({ pt_id: t.pt.id, nome: t.pt.nome })
    slots[chave] = lista
  }

  const horasEscalaPorPt = new Map<string, { id: string; nome: string; horas: number }>()
  for (const t of escalaSemana) {
    if (!t.pt) continue
    const atual = horasEscalaPorPt.get(t.pt.id) ?? { id: t.pt.id, nome: t.pt.nome, horas: 0 }
    atual.horas += 0.5
    horasEscalaPorPt.set(t.pt.id, atual)
  }
  const resumoEscalaSemana = [...horasEscalaPorPt.values()].sort((a, b) => b.horas - a.horas)

  const perfis = (perfisData ?? []) as Pick<Perfil, 'id' | 'nome' | 'papel' | 'ativo'>[]
  const idsComAcesso = new Set(listaPts.map((p) => p.id))
  // Uma cor por instrutor, pela ordem alfabética já devolvida por
  // getEquipaDoEstudio — usada na grelha e nos resumos ao lado dela.
  const corPorPt: Record<string, CorPt> = Object.fromEntries(
    listaPts.map((p, i) => [p.id, corInstrutor(i)])
  )

  return (
    <>
      <TituloSeccao cor="azul" id={`planeamento-${slug}`}>
        Semana
      </TituloSeccao>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/coordenacao/horarios${comQuery(sp, { [pk('semana')]: semanaAnterior })}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {fmt(diasSemana[0])} – {fmt(diasSemana[6])}
        </span>
        <Link
          href={`/painel/coordenacao/horarios${comQuery(sp, { [pk('semana')]: semanaSeguinte })}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          →
        </Link>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Clica num horário para marcar quem trabalha nesse bloco — podes escolher mais do que uma
        pessoa. A equipa vê esta escala em &quot;Horários&quot;, só para consulta.
      </p>
      <div className="mt-4">
        <GrelhaHorarios
          key={`${slug}-${inicioSemana}`}
          editavel
          dias={diasSemana}
          slots={slots}
          corPorPt={corPorPt}
          pts={listaPts}
          estudioSlug={slug}
          estudioId={estudio.id}
          semana={inicioSemana}
          guardar={guardarSemana}
        />
      </div>

      <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Horas planeadas esta semana
      </h3>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {resumoEscalaSemana.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-950"
          >
            <span
              className="rounded px-1.5 py-0.5 font-medium"
              style={{ background: corPorPt[r.id]?.bg, color: corPorPt[r.id]?.tx }}
            >
              {r.nome}
            </span>
            <span className="text-zinc-500">{r.horas}h</span>
          </div>
        ))}
        {resumoEscalaSemana.length === 0 && (
          <p className="text-sm text-zinc-500">Sem turnos marcados esta semana.</p>
        )}
      </div>

      <details className="mt-6 rounded-xl border border-black/10 dark:border-white/10">
        <summary className="flex cursor-pointer items-center gap-1.5 p-4 text-xs font-semibold uppercase tracking-wider text-[#5B3FA0]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3FA0]" />
          Instrutores
        </summary>
        <div className="border-t border-black/10 p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500">
            Só quem tem acesso aqui aparece para escolher no planeamento da semana.
          </p>

          <form
            action={criarInstrutor}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-black/20 p-3 dark:border-white/20"
          >
            <input type="hidden" name="estudio_id" value={estudio.id} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Nome</label>
              <input name="nome" required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Email</label>
              <input name="email" type="email" required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Telefone (opcional)</label>
              <input name="telefone" className={inputCls} />
            </div>
            <SubmitButton
              pendingText="A criar…"
              className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
            >
              Criar instrutor
            </SubmitButton>
          </form>
          <p className="mt-1.5 text-xs text-zinc-500">
            Cria já a ficha com acesso a este estúdio. Se um dia quiser entrar na app, usa
            &quot;Esqueci-me da password&quot; com este email.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {perfis.map((p) => {
              const temAcesso = idsComAcesso.has(p.id)
              const cor = corPorPt[p.id]
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
                >
                  <div className="flex items-center gap-2">
                    {cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor.tx }} />}
                    <span className="font-medium text-black dark:text-zinc-50">{p.nome}</span>
                    <span className="text-xs text-zinc-500">
                      {p.papel}
                      {!p.ativo && ' · inativo'}
                    </span>
                  </div>
                  <form action={alternarAcesso}>
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="estudio_id" value={estudio.id} />
                    <input type="hidden" name="perfil_id" value={p.id} />
                    <input type="hidden" name="tem_acesso" value={temAcesso ? '1' : '0'} />
                    <input type="hidden" name="destino" value="coordenacao/horarios" />
                    <SubmitButton
                      pendingText="…"
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        temAcesso
                          ? 'border border-black/10 text-zinc-700 hover:bg-black/[.04] dark:border-white/10 dark:text-zinc-300'
                          : 'bg-foreground text-background'
                      }`}
                    >
                      {temAcesso ? 'Remover' : 'Adicionar'}
                    </SubmitButton>
                  </form>
                </div>
              )
            })}
            {perfis.length === 0 && (
              <p className="text-sm text-zinc-500">Ainda não há ninguém registado.</p>
            )}
          </div>
        </div>
      </details>
    </>
  )
}
