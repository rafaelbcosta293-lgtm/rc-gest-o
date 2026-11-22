import { contaAtual, type Avaliacao, type Presenca } from '@/lib/dados'
import { dataCurta, nomeMes } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { presencasPorMes } from '@/lib/vistas'

export const metadata = { title: 'Progresso · RC Private Fitness Studio' }

const num = (v: number | null, casas = 1) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: casas }))

function Diferenca({ de, para, unidade, menosEMelhor }: { de: number | null; para: number | null; unidade: string; menosEMelhor: boolean }) {
  if (de == null || para == null) return null
  const d = Math.round((para - de) * 10) / 10
  if (d === 0) return <span className="text-xs text-muted">igual</span>
  const bom = menosEMelhor ? d < 0 : d > 0
  return (
    <span className={`text-xs font-semibold ${bom ? 'text-emerald-700' : 'text-amber-700'}`}>
      {d > 0 ? '+' : ''}
      {num(d)} {unidade}
    </span>
  )
}

export default async function ProgressoPage() {
  await contaAtual()
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
  const meses = presencasPorMes(presencas).slice(0, 12)
  const ultima = avaliacoes[0]
  const primeira = avaliacoes[avaliacoes.length - 1]

  return (
    <div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">O meu progresso</h1>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Avaliações físicas</h2>
      {!ultima ? (
        <p className="mt-2 rounded-2xl bg-white p-5 text-sm text-muted">Ainda não há avaliações registadas.</p>
      ) : (
        <>
          <div className="mt-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
            <p className="text-sm text-muted">
              Última avaliação: <span className="font-semibold text-foreground">{dataCurta(ultima.data)}</span>
              {ultima.proxima_reavaliacao && <> · próxima em {dataCurta(ultima.proxima_reavaliacao)}</>}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {[
                { rotulo: 'Peso', v: ultima.peso_kg, u: 'kg', ant: primeira.peso_kg, menos: true },
                { rotulo: 'Massa gorda', v: ultima.massa_gorda_pct, u: '%', ant: primeira.massa_gorda_pct, menos: true },
                { rotulo: 'Massa muscular', v: ultima.massa_muscular_kg, u: 'kg', ant: primeira.massa_muscular_kg, menos: false },
                { rotulo: 'IMC', v: ultima.imc, u: '', ant: primeira.imc, menos: true },
              ].map((m) => (
                <div key={m.rotulo} className="rounded-xl bg-zinc-50 p-3">
                  <dt className="text-xs text-muted">{m.rotulo}</dt>
                  <dd className="text-xl font-bold tabular-nums">
                    {num(m.v)}
                    {m.v != null && m.u && <span className="ml-0.5 text-sm font-medium">{m.u}</span>}
                  </dd>
                  {avaliacoes.length > 1 && <Diferenca de={m.ant} para={m.v} unidade={m.u} menosEMelhor={m.menos} />}
                </div>
              ))}
            </dl>
            {avaliacoes.length > 1 && <p className="mt-2 text-xs text-muted">Diferenças desde a primeira avaliação ({dataCurta(primeira.data)}).</p>}
          </div>
          {avaliacoes.length > 1 && (
            <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 text-right font-medium">Peso</th>
                    <th className="px-3 py-2 text-right font-medium">M. gorda</th>
                    <th className="px-3 py-2 text-right font-medium">M. musc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {avaliacoes.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2">{dataCurta(a.data)}</td>
                      <td className="px-3 py-2 text-right">{num(a.peso_kg)} kg</td>
                      <td className="px-3 py-2 text-right">{num(a.massa_gorda_pct)} %</td>
                      <td className="px-3 py-2 text-right">{num(a.massa_muscular_kg)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted">Presenças</h2>
      {meses.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-white p-5 text-sm text-muted">Ainda sem presenças registadas.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-2xl bg-white shadow-sm ring-1 ring-border">
          {meses.map((m) => (
            <li key={m.mes} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold capitalize">{nomeMes(m.mes)}</span>
              <span className="tabular-nums">
                <span className="font-bold text-emerald-700">{m.presentes}</span> treinos
                {m.faltas > 0 && <span className="text-muted"> · {m.faltas} faltas</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
