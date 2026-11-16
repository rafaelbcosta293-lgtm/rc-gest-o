import Link from '@/components/LinkRapido'
import { AlertTriangle } from 'lucide-react'
import { haQuantoTempo, idadeEmDias, type EstatisticasTarefas } from '@/lib/data/tarefas'
import type { Contexto } from './partes'

// O painel das Tarefas: números para acompanhar se o trabalho anda —
// quanto está aberto e em atraso, quanto se conclui por semana, quem tem
// o quê, e o que está parado há mais tempo.
//
// Gráficos de um só tom (as quantidades leem-se pelo comprimento); os
// números ficam sempre na cor do texto, e cada gráfico tem a sua tabela.

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Numero({ rotulo, valor, nota, aviso }: { rotulo: string; valor: string; nota?: string; aviso?: boolean }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{rotulo}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-bold text-foreground">
        {aviso && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="Atenção" />}
        {valor}
      </p>
      {nota && <p className="text-xs text-muted">{nota}</p>}
    </div>
  )
}

// Uma linha de barras horizontais: nome, barra e números, com as barras
// alinhadas na mesma base.
function LinhaDeBarra({ nome, valor, maximo, detalhe, href }: { nome: string; valor: number; maximo: number; detalhe: string; href?: string }) {
  const largura = maximo > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / maximo) * 100) : 0
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 py-1.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
      {href ? (
        <Link href={href} className="truncate text-sm font-semibold text-foreground hover:underline">
          {nome}
        </Link>
      ) : (
        <span className="truncate text-sm font-semibold text-foreground">{nome}</span>
      )}
      <div className="flex items-center gap-2" title={`${nome}: ${detalhe}`}>
        <div className="h-3 flex-1 bg-[var(--viz-trilho)]" style={{ borderRadius: '0 4px 4px 0' }}>
          <div className="h-3 bg-[var(--viz-serie)]" style={{ width: `${largura}%`, borderRadius: '0 4px 4px 0' }} />
        </div>
        <span className="w-6 text-right text-sm font-semibold text-foreground">{valor}</span>
      </div>
      <span className="col-span-2 text-xs text-muted sm:col-span-1">{detalhe}</span>
    </li>
  )
}

export default function PainelTarefas({
  est,
  ctx,
  linkPessoa,
  linkLista,
}: {
  est: EstatisticasTarefas
  ctx: Contexto
  linkPessoa: (id: string | null) => string
  linkLista: (lista: string) => string
}) {
  const maxSemana = Math.max(1, ...est.porSemana.map((s) => s.total))
  const indiceMaior = est.porSemana.findIndex((s) => s.total === maxSemana)
  const pctNoPrazo = est.comPrazo30 > 0 ? Math.round((est.noPrazo30 / est.comPrazo30) * 100) : null
  const maxPessoa = Math.max(1, ...est.porPessoa.map((p) => p.abertas))
  const maxLista = Math.max(1, ...est.porLista.map((l) => l.abertas))
  const maxQuemFez = Math.max(1, ...est.porQuemFez.map((p) => p.feitas30))
  // Por norma as tarefas não têm responsável: "Por pessoa" só interessa quando alguma tem.
  const haResponsaveis = est.porPessoa.some((p) => p.id !== null)

  return (
    <div className="viz-tarefas mt-6 flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero rotulo="Abertas" valor={String(est.abertas)} nota={`${est.semPrazo} sem prazo`} />
        <Numero rotulo="Em atraso" valor={String(est.emAtraso)} nota="prazo já passou" aviso={est.emAtraso > 0} />
        <Numero rotulo="Para hoje" valor={String(est.paraHoje)} />
        <Numero rotulo="Concluídas (7 dias)" valor={String(est.feitas7)} nota={`${est.feitas30} em 30 dias`} />
        <Numero
          rotulo="Dentro do prazo"
          valor={pctNoPrazo === null ? '—' : `${pctNoPrazo}%`}
          nota={pctNoPrazo === null ? 'sem concluídas com prazo' : `${est.noPrazo30} de ${est.comPrazo30} (30 dias)`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Quem fez */}
        <section className="rounded-xl border border-border-subtle bg-surface p-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-foreground">Quem realizou as tarefas</h2>
          <p className="text-xs text-muted">
            Tarefas concluídas por cada pessoa nos últimos 30 dias (o nome indicado ao concluir). Ao lado: as dos últimos 7 dias.
          </p>
          {est.porQuemFez.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Ainda não há tarefas concluídas neste período.</p>
          ) : (
            <ul className="mt-3">
              {est.porQuemFez.map((p) => (
                <LinhaDeBarra
                  key={p.id ?? 'sem'}
                  nome={p.id ? (ctx.nomePessoa.get(p.id) ?? '—') : 'Sem nome indicado'}
                  valor={p.feitas30}
                  maximo={maxQuemFez}
                  detalhe={`${est.feitas30 > 0 ? Math.round((p.feitas30 / est.feitas30) * 100) : 0}% do total · ${p.feitas7} nos últimos 7 dias`}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Concluídas por semana */}
        <section className="rounded-xl border border-border-subtle bg-surface p-4">
          <h2 className="text-sm font-bold text-foreground">Tarefas concluídas por semana</h2>
          <p className="text-xs text-muted">Últimas 8 semanas, de segunda a domingo. A última é a semana em curso.</p>
          <div className="mt-4 flex h-40 items-end gap-2 border-b border-border-strong">
            {est.porSemana.map((s, i) => {
              const ultima = i === est.porSemana.length - 1
              const rotulada = ultima || i === indiceMaior
              return (
                <div
                  key={s.inicio}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  title={`Semana de ${dataCurta(s.inicio)}: ${s.total} concluída${s.total === 1 ? '' : 's'}`}
                >
                  {rotulada && <span className="mb-1 text-xs font-semibold text-foreground">{s.total}</span>}
                  {!rotulada && (
                    <span className="mb-1 hidden rounded bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background group-hover:block">
                      {s.total}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-6 ${ultima ? 'bg-[var(--viz-serie)]' : 'bg-[color-mix(in_srgb,var(--viz-serie)_55%,transparent)]'} group-hover:bg-[var(--viz-serie)]`}
                    style={{
                      height: `${(s.total / maxSemana) * 78}%`,
                      minHeight: s.total > 0 ? 3 : 0,
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-2">
            {est.porSemana.map((s) => (
              <span key={s.inicio} className="flex-1 text-center text-[10px] text-muted">
                {dataCurta(s.inicio)}
              </span>
            ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted">Ver em tabela</summary>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-left text-muted">
                  <th className="py-1 font-semibold">Semana de</th>
                  <th className="py-1 text-right font-semibold">Concluídas</th>
                </tr>
              </thead>
              <tbody>
                {est.porSemana.map((s) => (
                  <tr key={s.inicio} className="border-b border-border-subtle/60 last:border-0">
                    <td className="py-1 text-foreground">{dataCurta(s.inicio)}</td>
                    <td className="py-1 text-right font-mono text-foreground">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        {/* Há mais tempo em aberto */}
        <section className="rounded-xl border border-border-subtle bg-surface p-4">
          <h2 className="text-sm font-bold text-foreground">Abertas há mais tempo</h2>
          <p className="text-xs text-muted">As tarefas que esperam há mais tempo (sem contar as rotinas que se repetem).</p>
          {est.maisAntigas.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nada em aberto.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border-subtle/60">
              {est.maisAntigas.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-3 py-2">
                  <Link href={ctx.linkEditar(t.id)} className="min-w-0 truncate text-sm font-semibold text-foreground hover:underline">
                    {t.titulo}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {t.responsavel_id ? `${ctx.nomePessoa.get(t.responsavel_id)?.split(' ')[0] ?? '—'} · ` : ''}
                    criada {haQuantoTempo(idadeEmDias(t.criado_em, ctx.hoje))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Por responsável */}
        {haResponsaveis && (
          <section className="rounded-xl border border-border-subtle bg-surface p-4">
            <h2 className="text-sm font-bold text-foreground">Por responsável</h2>
            <p className="text-xs text-muted">Tarefas abertas atribuídas a cada um. Ao lado: as que estão em atraso e as concluídas em 30 dias.</p>
            {est.porPessoa.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Ainda não há tarefas.</p>
            ) : (
              <ul className="mt-3">
                {est.porPessoa.map((p) => (
                  <LinhaDeBarra
                    key={p.id ?? 'sem'}
                    nome={p.id ? (ctx.nomePessoa.get(p.id) ?? '—') : 'Sem responsável'}
                    valor={p.abertas}
                    maximo={maxPessoa}
                    detalhe={`${p.emAtraso} em atraso · ${p.feitas30} concluída${p.feitas30 === 1 ? '' : 's'}`}
                    href={linkPessoa(p.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Por lista */}
        <section className="rounded-xl border border-border-subtle bg-surface p-4">
          <h2 className="text-sm font-bold text-foreground">Por lista</h2>
          <p className="text-xs text-muted">Tarefas abertas em cada lista. Ao lado: as concluídas em 30 dias.</p>
          {est.porLista.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Ainda não há tarefas.</p>
          ) : (
            <ul className="mt-3">
              {est.porLista.map((l) => (
                <LinhaDeBarra
                  key={l.lista ?? 'sem'}
                  nome={l.lista ?? 'Sem lista'}
                  valor={l.abertas}
                  maximo={maxLista}
                  detalhe={`${l.feitas30} concluída${l.feitas30 === 1 ? '' : 's'} em 30 dias`}
                  href={l.lista ? linkLista(l.lista) : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
