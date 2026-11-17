import Link from '@/components/LinkRapido'
import { AlertTriangle, CalendarX2, CreditCard, Users } from 'lucide-react'
import { ESTADOS_CLIENTE } from '@/lib/data/constantes'
import { fmt } from '@/lib/data/presencas'
import { emAtraso, semAulaMarcada, DIAS_SEM_AULA, type ClienteDoServico, type ResumoServico } from '@/lib/data/gestaoServicoGrupo'

function Cartao({ valor, rotulo, destaque }: { valor: string | number; rotulo: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${destaque ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-border-subtle bg-surface'}`}>
      <p className={`text-xl font-bold ${destaque ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>{valor}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{rotulo}</p>
    </div>
  )
}

function Etiqueta({ estado }: { estado: string }) {
  const cor = ESTADOS_CLIENTE[estado as keyof typeof ESTADOS_CLIENTE] ?? ESTADOS_CLIENTE.Ativo
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: cor.bg, color: cor.tx }}>
      {cor.label}
    </span>
  )
}

// Os números do serviço e as listas para tratar (no topo da página).
export function ResumoCartoes({ resumo }: { resumo: ResumoServico }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Cartao valor={resumo.ativos} rotulo="Clientes ativos" />
      <Cartao valor={resumo.pendentes} rotulo="Pendentes" />
      <Cartao valor={resumo.emAtraso} rotulo="Pagamentos em atraso" destaque={resumo.emAtraso > 0} />
      <Cartao valor={resumo.semAulasMarcadas} rotulo={`Sem aulas (${DIAS_SEM_AULA} dias)`} destaque={resumo.semAulasMarcadas > 0} />
      <Cartao valor={resumo.tambemPt} rotulo="Também fazem PT" />
      <Cartao valor={resumo.ocupacaoSemana == null ? '—' : `${resumo.ocupacaoSemana}%`} rotulo={`Ocupação (${resumo.aulasSemana} aulas)`} />
    </div>
  )
}

// Gestão isolada de um serviço de grupo: o que precisa de atenção
// (pagamentos em atraso, ativos sem aulas marcadas) e a lista de clientes
// do serviço — os que só fazem este serviço e os que também fazem PT.
export default function GestaoServico({
  slug,
  servicoNome,
  clientes,
  resumo,
  hoje,
  mostrarInativos,
  hrefInativos,
}: {
  slug: string
  servicoNome: string
  clientes: ClienteDoServico[]
  resumo: ResumoServico
  hoje: string
  mostrarInativos: boolean
  hrefInativos: string
}) {
  const atrasados = clientes.filter(emAtraso)
  const semAula = clientes.filter((c) => semAulaMarcada(c, hoje))
  const lista = clientes.filter((c) => mostrarInativos || c.estado !== 'Inativo')
  const inativos = clientes.filter((c) => c.estado === 'Inativo').length

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ResumoCartoes resumo={resumo} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-border-subtle bg-surface p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <CreditCard className="h-4 w-4 text-red-600" /> Pagamentos em atraso ({atrasados.length})
          </h2>
          <p className="text-xs text-muted">Só as mensalidades de {servicoNome} (as de PT ficam no PT).</p>
          <ul className="mt-2 flex flex-col divide-y divide-border-subtle">
            {atrasados.map((c) => (
              <li key={c.clienteId} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                <Link href={`/painel/${slug}/clientes/${c.clienteId}`} className="flex-1 font-medium text-foreground hover:underline">
                  {c.nome}
                </Link>
                <span className="text-xs text-red-700 dark:text-red-300">{c.validoAte ? `venceu a ${fmt(c.validoAte)}` : 'ainda sem pagamentos'}</span>
                <Link
                  href={`/painel/${slug}/pagamentos/${c.clienteId}`}
                  className="rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold hover:bg-brand/[.08]"
                >
                  Registar pagamento
                </Link>
              </li>
            ))}
            {atrasados.length === 0 && <li className="py-1.5 text-sm text-muted">Ninguém em atraso. 👍</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border-subtle bg-surface p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <CalendarX2 className="h-4 w-4 text-amber-600" /> Ativos sem aulas marcadas ({semAula.length})
          </h2>
          <p className="text-xs text-muted">Sem nenhuma aula nos próximos {DIAS_SEM_AULA} dias — vale a pena contactar.</p>
          <ul className="mt-2 flex flex-col divide-y divide-border-subtle">
            {semAula.map((c) => (
              <li key={c.clienteId} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                <Link href={`/painel/${slug}/clientes/${c.clienteId}`} className="flex-1 font-medium text-foreground hover:underline">
                  {c.nome}
                </Link>
                <span className="text-xs text-muted">
                  {c.proximaAula ? `próxima a ${fmt(c.proximaAula)}` : c.ultimaPresenca ? `última aula a ${fmt(c.ultimaPresenca)}` : 'ainda sem aulas'}
                </span>
                {c.telefone && <span className="text-xs text-muted">{c.telefone}</span>}
              </li>
            ))}
            {semAula.length === 0 && <li className="py-1.5 text-sm text-muted">Todos os ativos têm aulas marcadas. 👍</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Users className="h-4 w-4" /> Clientes de {servicoNome} ({lista.length})
          </h2>
          {inativos > 0 && (
            <Link href={hrefInativos} scroll={false} className="text-xs font-semibold text-muted underline">
              {mostrarInativos ? 'Esconder inativos' : `Mostrar também os inativos (${inativos})`}
            </Link>
          )}
        </div>
        <p className="text-xs text-muted">
          Para inscrever alguém neste serviço: na ficha do cliente, Editar ficha → Serviços. Quem também faz PT aparece aqui e no
          PT, com o estado de cada lado.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2 font-semibold">Cliente</th>
                <th className="py-1.5 pr-2 font-semibold">Estado</th>
                <th className="py-1.5 pr-2 font-semibold">Pagamento</th>
                <th className="py-1.5 pr-2 font-semibold">Próxima aula</th>
                <th className="py-1.5 pr-2 font-semibold">Aulas este mês</th>
                <th className="py-1.5 pr-2 font-semibold">Também PT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {lista.map((c) => (
                <tr key={c.clienteId}>
                  <td className="py-1.5 pr-2">
                    <Link href={`/painel/${slug}/clientes/${c.clienteId}`} className="font-medium text-foreground hover:underline">
                      {c.nome}
                    </Link>
                    {c.numeroSocio && <span className="ml-1.5 font-mono text-xs text-muted">{c.numeroSocio}</span>}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Etiqueta estado={c.estado} />
                  </td>
                  <td className={`py-1.5 pr-2 text-xs ${emAtraso(c) ? 'text-red-700 dark:text-red-300' : 'text-muted'}`}>
                    {c.validoAte ? `${c.emDia ? 'válido até' : 'venceu a'} ${fmt(c.validoAte)}` : 'sem pagamentos'}
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-muted">{c.proximaAula ? fmt(c.proximaAula) : '—'}</td>
                  <td className="py-1.5 pr-2 text-xs text-muted">{c.presencasMes}</td>
                  <td className="py-1.5 pr-2">{c.estadoPt ? <Etiqueta estado={c.estadoPt} /> : <span className="text-xs text-muted">—</span>}</td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-sm text-muted">
                    <AlertTriangle className="mr-1 inline h-4 w-4" />
                    Ainda não há clientes inscritos em {servicoNome}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
