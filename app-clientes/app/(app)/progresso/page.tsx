import { ArrowDownRight, ArrowUpRight, ClipboardList, Minus } from 'lucide-react'
import { Cartao, Seccao, TituloPagina, Vazio } from '@/components/ui'
import { contaAtual, type Avaliacao, type Presenca } from '@/lib/dados'
import { dataCurta, hojeLisboa, nomeMes } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { plural, presencasPorMes, variacao } from '@/lib/vistas'

export const metadata = { title: 'Progresso' }

const num = (v: number | null, casas = 1) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: casas }))

// Variação desde a primeira avaliação. Só se dá "bom/menos bom" onde o
// sentido é claro (massa gorda a descer, massa muscular a subir); no peso
// e no IMC depende do objetivo de cada pessoa, por isso fica neutro.
function Variacao({ valor, unidade, bom }: { valor: number | null; unidade: string; bom?: 'descer' | 'subir' }) {
  if (valor == null) return null
  const Icone = valor === 0 ? Minus : valor < 0 ? ArrowDownRight : ArrowUpRight
  const cor = !bom || valor === 0 ? 'text-muted' : (bom === 'descer' ? valor < 0 : valor > 0) ? 'text-emerald-700' : 'text-amber-700'
  return (
    <p className={`mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold ${cor}`}>
      <Icone className="h-3.5 w-3.5" />
      {valor === 0 ? 'igual' : `${valor > 0 ? '+' : '−'}${num(Math.abs(valor))}${unidade ? ` ${unidade}` : ''}`}
    </p>
  )
}

export default async function ProgressoPage() {
  await contaAtual()
  const hoje = hojeLisboa()
  const supabase = await criarSupabase()
  const [{ data: presData }, { data: avData }] = await Promise.all([
    supabase.from('presencas').select('id, data, estado, tipo').order('data', { ascending: false }),
    supabase
      .from('avaliacoes')
      .select('id, data, peso_kg, massa_gorda_pct, massa_muscular_kg, gordura_visceral, hidratacao_pct, imc, idade_metabolica, proxima_reavaliacao')
      .order('data', { ascending: false }),
  ])
  const presencas = (presData ?? []) as Presenca[]
  const avaliacoes = (avData ?? []) as Avaliacao[]
  const meses = presencasPorMes(presencas).slice(0, 6)
  const maximo = Math.max(1, ...meses.map((m) => m.presentes))
  const ultima = avaliacoes[0]
  const primeira = avaliacoes[avaliacoes.length - 1]
  const varias = avaliacoes.length > 1

  const principais = ultima
    ? [
        { rotulo: 'Peso', v: ultima.peso_kg, u: 'kg', d: variacao(primeira.peso_kg, ultima.peso_kg), bom: undefined },
        { rotulo: 'Massa gorda', v: ultima.massa_gorda_pct, u: '%', d: variacao(primeira.massa_gorda_pct, ultima.massa_gorda_pct), bom: 'descer' as const },
        { rotulo: 'Massa muscular', v: ultima.massa_muscular_kg, u: 'kg', d: variacao(primeira.massa_muscular_kg, ultima.massa_muscular_kg), bom: 'subir' as const },
        { rotulo: 'IMC', v: ultima.imc, u: '', d: variacao(primeira.imc, ultima.imc), bom: undefined },
      ]
    : []
  const outros = ultima
    ? [
        { rotulo: 'Gordura visceral', v: ultima.gordura_visceral, u: '' },
        { rotulo: 'Hidratação', v: ultima.hidratacao_pct, u: '%' },
        { rotulo: 'Idade metabólica', v: ultima.idade_metabolica, u: 'anos' },
      ].filter((o) => o.v != null)
    : []

  return (
    <div>
      <TituloPagina titulo="Progresso" subtitulo="As suas avaliações físicas e a assiduidade aos treinos." />

      <Seccao titulo="Avaliação física">
        {!ultima ? (
          <Vazio Icone={ClipboardList} titulo="Ainda sem avaliações">
            Depois da sua primeira avaliação física, os resultados aparecem aqui.
          </Vazio>
        ) : (
          <>
            <Cartao className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-semibold">Última avaliação</p>
                <p className="text-sm text-muted">{dataCurta(ultima.data, hoje)}</p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2.5">
                {principais.map((m) => (
                  <div key={m.rotulo} className="rounded-xl bg-soft p-3.5">
                    <dt className="text-xs font-medium text-muted">{m.rotulo}</dt>
                    <dd className="mt-1 text-2xl leading-none font-bold tabular-nums">
                      {num(m.v)}
                      {m.v != null && m.u && <span className="ml-1 text-sm font-semibold text-muted">{m.u}</span>}
                    </dd>
                    {varias && <Variacao valor={m.d} unidade={m.u} bom={m.bom} />}
                  </div>
                ))}
              </dl>
              {varias && <p className="mt-3 text-xs leading-snug text-muted">Variação desde a primeira avaliação, em {dataCurta(primeira.data, hoje)}.</p>}
              {outros.length > 0 && (
                <dl className="mt-3 divide-y divide-border border-t border-border">
                  {outros.map((o) => (
                    <div key={o.rotulo} className="flex items-center justify-between py-2.5 text-sm last:pb-0">
                      <dt className="text-muted">{o.rotulo}</dt>
                      <dd className="font-semibold tabular-nums">
                        {num(o.v)}
                        {o.u ? ` ${o.u}` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Cartao>

            {ultima.proxima_reavaliacao && (
              <p className="mt-3 rounded-xl bg-brand/20 px-4 py-3 text-sm leading-snug text-brand-ink">
                Próxima reavaliação prevista para <span className="font-semibold">{dataCurta(ultima.proxima_reavaliacao, hoje)}</span>.
              </p>
            )}

            {varias && (
              <Cartao className="mt-3 overflow-hidden">
                <table className="w-full text-sm">
                  <caption className="px-4 pt-3.5 pb-1 text-left font-semibold">Histórico</caption>
                  <thead>
                    <tr className="text-xs text-muted">
                      <th scope="col" className="py-2 pr-2 pl-4 text-left font-medium">
                        Data
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">
                        Peso
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">
                        M. gorda
                      </th>
                      <th scope="col" className="py-2 pr-4 pl-2 text-right font-medium">
                        M. muscular
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border border-t border-border tabular-nums">
                    {avaliacoes.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2.5 pr-2 pl-4 whitespace-nowrap">{dataCurta(a.data, hoje)}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap">{num(a.peso_kg)} kg</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap">{num(a.massa_gorda_pct)} %</td>
                        <td className="py-2.5 pr-4 pl-2 text-right whitespace-nowrap">{num(a.massa_muscular_kg)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Cartao>
            )}
          </>
        )}
      </Seccao>

      <Seccao titulo="Assiduidade">
        {meses.length === 0 ? (
          <Vazio Icone={ClipboardList} titulo="Ainda sem presenças">
            As suas presenças nos treinos e nas aulas aparecem aqui.
          </Vazio>
        ) : (
          <Cartao className="p-4">
            <p className="text-sm text-muted">Presenças nos últimos {plural(meses.length, 'mês', 'meses')}</p>
            <ul className="mt-3 space-y-3">
              {meses.map((m) => (
                <li key={m.mes}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium first-letter:uppercase">{nomeMes(m.mes)}</span>
                    <span className="tabular-nums">
                      <span className="font-bold">{m.presentes}</span>
                      {m.faltas > 0 && <span className="text-muted"> · {plural(m.faltas, 'falta', 'faltas')}</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full bg-zinc-900" style={{ width: `${(m.presentes / maximo) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </Seccao>
    </div>
  )
}
