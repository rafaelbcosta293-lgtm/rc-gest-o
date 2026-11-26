import Link from '@/components/LinkRapido'
import { ArrowLeft, ClipboardX, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEquipaDoEstudio, getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { areaBloqueada } from '@/lib/data/gate'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { diaCurto } from '@/lib/data/presencas'
import {
  calcularAvaliacaoInstrutores,
  INICIO_CONTROLO,
  periodoDaAvaliacao,
  taxaDePlano,
  type LinhaInstrutor,
  type ModoPeriodo,
} from '@/lib/data/controloInstrutores'
import { carregarAvaliacaoInstrutores } from '@/lib/data/controloInstrutoresDados'
import { Barra, BarraOpcoes, BarraPeriodo, BarraSeparador } from '@/components/Barra'
import PortaSenha from '@/components/PortaSenha'
import { desbloquearAdmin } from '../actions'

export const metadata = { title: 'Avaliação de instrutores' }

const ROTA = '/painel/admin/instrutores'

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)} %`)

// Cor da taxa de treinos com plano: verde a partir de 90 %, âmbar a
// partir de 60 %, vermelho abaixo.
const corDaTaxa = (v: number | null) =>
  v == null ? 'text-muted' : v >= 0.9 ? 'text-teal-700 dark:text-teal-300' : v >= 0.6 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-300'

// Avaliação dos instrutores, por trimestre ou por mês: os treinos que
// cada um deu (e a que clientes), quantos tinham plano de treino, e os
// planos que cada um fez. Lê sempre o que está na Agenda e nos planos
// nesse momento.
export default async function AdminInstrutoresPage({
  searchParams,
}: {
  searchParams: Promise<{ estudio?: string; dia?: string; modo?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  if (await areaBloqueada(supabase, 'admin')) {
    return <PortaSenha titulo="Administração — Avaliação de instrutores" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const todos = await getEstudios(supabase)
  const estudios = filtrarPorEstudio(todos, sp.estudio)
  const umSo = estudios.length === 1 ? estudios[0] : undefined
  const hoje = hojeEmLisboa()
  const modo: ModoPeriodo = sp.modo === 'mes' ? 'mes' : 'trimestre'
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : hoje
  const periodo = periodoDaAvaliacao(dia, modo)
  const periodoDeHoje = periodoDaAvaliacao(hoje, modo)

  const [dados, ...equipas] = await Promise.all([
    carregarAvaliacaoInstrutores(supabase, umSo?.id ?? null, periodo.inicio, periodo.fimExclusivo, hoje),
    ...estudios.map((e) => getEquipaDoEstudio(supabase, e.id)),
  ])
  // A equipa dos estúdios escolhidos, mais quem aparece nos dados e já
  // não está na equipa.
  const instrutores = new Map<string, { id: string; nome: string }>()
  for (const p of [...equipas.flat(), ...dados.instrutores]) if (!instrutores.has(p.id)) instrutores.set(p.id, p)
  const r = calcularAvaliacaoInstrutores(dados.eventos, dados.planos, [...instrutores.values()])
  const antesDoControlo = periodo.fimExclusivo <= INICIO_CONTROLO
  const aindaNaoComecou = periodo.inicio > hoje

  const link = (o: { estudio?: string; dia?: string; modo?: ModoPeriodo }) => {
    const p = new URLSearchParams()
    if (o.estudio) p.set('estudio', o.estudio)
    if (o.modo === 'mes') p.set('modo', 'mes')
    if (o.dia && periodoDaAvaliacao(o.dia, o.modo ?? 'trimestre').inicio !== periodoDaAvaliacao(hoje, o.modo ?? 'trimestre').inicio) p.set('dia', o.dia)
    const qs = p.toString()
    return qs ? `${ROTA}?${qs}` : ROTA
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Avaliação de instrutores</h1>
      <p className="mt-1 text-sm text-muted">
        {estudios.map((e) => e.nome).join(' + ')} · treinos dados por cada instrutor, a que clientes, e quantos tinham plano de treino.
      </p>

      <Barra rotulo="Estúdio e período" className="mt-5 w-fit max-w-full">
        <BarraOpcoes
          opcoes={[
            { href: link({ dia, modo }), rotulo: 'Os dois', ativo: !umSo },
            ...todos.map((e) => ({ href: link({ estudio: e.slug, dia, modo }), rotulo: e.nome, ativo: umSo?.slug === e.slug })),
          ]}
        />
        <BarraSeparador className="sempre max-sm:hidden" />
        <BarraOpcoes
          opcoes={[
            { href: link({ estudio: umSo?.slug, dia, modo: 'trimestre' }), rotulo: 'Trimestre', ativo: modo === 'trimestre' },
            { href: link({ estudio: umSo?.slug, dia, modo: 'mes' }), rotulo: 'Mês', ativo: modo === 'mes' },
          ]}
        />
        <BarraSeparador className="sempre max-sm:hidden" />
        <BarraPeriodo
          className="max-sm:w-full"
          anterior={link({ estudio: umSo?.slug, dia: periodo.anterior, modo })}
          seguinte={periodo.seguinte <= hoje ? link({ estudio: umSo?.slug, dia: periodo.seguinte, modo }) : null}
          titulo={periodo.titulo}
          largura="21ch"
          hoje={link({ estudio: umSo?.slug, modo })}
          noPeriodoDeHoje={periodo.inicio === periodoDeHoje.inicio}
          rotuloHoje="Atual"
        />
      </Barra>

      {antesDoControlo || aindaNaoComecou ? (
        <p className="mt-6 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
          {antesDoControlo
            ? `Sem dados neste período: o controlo dos instrutores começou a ${diaCurto(INICIO_CONTROLO)}.`
            : 'Este período ainda não começou.'}
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cartao valor={String(r.totalTreinos)} legenda="treinos dados (por cliente)" />
            <Cartao
              valor={pct(r.totalTreinos > 0 ? r.totalComPlano / r.totalTreinos : null)}
              legenda={`com plano de treino (${r.totalComPlano} de ${r.totalTreinos})`}
              cor={corDaTaxa(r.totalTreinos > 0 ? r.totalComPlano / r.totalTreinos : null)}
            />
            <Cartao
              valor={String(r.treinosSemInstrutor)}
              legenda="treinos sem instrutor"
              cor={r.treinosSemInstrutor > 0 ? 'text-red-700 dark:text-red-300' : undefined}
              icone={<UserX className="h-4 w-4" />}
            />
            <Cartao
              valor={String(r.planosSemTreino)}
              legenda="planos sem treino associado"
              cor={r.planosSemTreino > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}
              icone={<ClipboardX className="h-4 w-4" />}
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Instrutor</th>
                  <th className="px-3 py-2 text-right font-semibold">Treinos dados</th>
                  <th className="px-3 py-2 text-right font-semibold">Clientes</th>
                  <th className="px-3 py-2 text-right font-semibold">Com plano</th>
                  <th className="px-3 py-2 text-right font-semibold">Sem plano</th>
                  <th className="px-3 py-2 text-right font-semibold">% com plano</th>
                  <th className="px-3 py-2 text-right font-semibold">Registados</th>
                  <th className="px-3 py-2 text-right font-semibold">Planos que fez</th>
                  <th className="px-3 py-2 text-right font-semibold">Antes do treino</th>
                </tr>
              </thead>
              <tbody>
                {r.linhas.map((l) => (
                  <LinhaDoInstrutor key={l.ptId} l={l} />
                ))}
                {r.linhas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-muted">
                      Sem instrutores nem treinos neste período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">A que clientes deu treino</h2>
          <div className="mt-2 flex flex-col gap-2">
            {r.linhas
              .filter((l) => l.clientes.length > 0)
              .map((l) => (
                <details key={l.ptId} className="rounded-xl border border-border-subtle bg-surface">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <strong className="text-foreground">{l.nome}</strong>
                    <span className="text-muted">
                      {l.clientes.length === 1 ? '1 cliente' : `${l.clientes.length} clientes`} · {l.treinosCliente} treinos
                    </span>
                  </summary>
                  <table className="w-full border-t border-border-subtle text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Cliente</th>
                        <th className="px-4 py-2 text-right font-semibold">Treinos</th>
                        <th className="px-4 py-2 text-right font-semibold">Com plano</th>
                        <th className="px-4 py-2 text-right font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.clientes.map((c) => {
                        const t = c.treinos > 0 ? c.comPlano / c.treinos : null
                        return (
                          <tr key={c.clienteId} className="border-t border-border-subtle">
                            <td className="px-4 py-1.5 text-foreground">{c.nome}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted">{c.treinos}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted">{c.comPlano}</td>
                            <td className={`px-4 py-1.5 text-right font-semibold tabular-nums ${corDaTaxa(t)}`}>{pct(t)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </details>
              ))}
            {r.linhas.every((l) => l.clientes.length === 0) && (
              <p className="rounded-xl border border-dashed border-border-subtle p-4 text-center text-sm text-muted">
                Ainda não há treinos com instrutor associado neste período.
              </p>
            )}
          </div>
        </>
      )}

      <ul className="mt-6 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
        <li>
          Conta a partir de <strong>{diaCurto(INICIO_CONTROLO)}</strong>, só com treinos que já aconteceram (até hoje) e que não foram desmarcados.
        </li>
        <li>
          <strong>Treinos dados</strong>: os treinos da Agenda em que o instrutor está associado. Um treino em simultâneo (dupla, trio) conta uma vez, mas
          pede um plano por cliente.
        </li>
        <li>
          <strong>Com plano</strong>: o treino tem um plano de treino associado e com exercícios — um plano vazio não conta. <strong>Registados</strong>: os
          que, além disso, ficaram com o “como correu” preenchido depois do treino.
        </li>
        <li>
          <strong>Planos que fez</strong>: planos (com exercícios) em que o instrutor está como autor, seja quem for que deu o treino.{' '}
          <strong>Antes do treino</strong>: os que foram criados antes da hora do treino.
        </li>
        <li>Treinos sem instrutor não contam para ninguém; planos sem treino associado ficam fora do “com plano”.</li>
      </ul>
    </div>
  )
}

function Cartao({ valor, legenda, cor, icone }: { valor: string; legenda: string; cor?: string; icone?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <strong className={`flex items-center gap-1.5 text-lg tabular-nums ${cor ?? 'text-foreground'}`}>
        {icone}
        {valor}
      </strong>
      <span className="text-xs text-muted">{legenda}</span>
    </div>
  )
}

function LinhaDoInstrutor({ l }: { l: LinhaInstrutor }) {
  const taxa = taxaDePlano(l)
  const num = 'px-3 py-2 text-right tabular-nums'
  return (
    <tr className="border-t border-border-subtle">
      <td className="px-3 py-2 font-medium text-foreground">{l.nome}</td>
      <td className={`${num} text-foreground`}>{l.treinos}</td>
      <td className={`${num} text-muted`}>{l.clientes.length}</td>
      <td className={`${num} text-muted`}>{l.comPlano}</td>
      <td className={`${num} ${l.semPlano > 0 ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted'}`}>{l.semPlano}</td>
      <td className={`${num} font-semibold ${corDaTaxa(taxa)}`}>{pct(taxa)}</td>
      <td className={`${num} text-muted`}>{l.registados}</td>
      <td className={`${num} text-muted`}>
        {l.planosFeitos}
        {l.planosVazios > 0 && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">(+{l.planosVazios} vazios)</span>}
      </td>
      <td className={`${num} text-muted`}>{l.planosFeitos > 0 ? `${l.planosATempo} de ${l.planosFeitos}` : '—'}</td>
    </tr>
  )
}
