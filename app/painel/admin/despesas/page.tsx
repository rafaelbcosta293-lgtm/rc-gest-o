import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import {
  CATEGORIA_AJUSTE,
  balancoMes,
  dataNoMes,
  estadoDespesa,
  gerarDespesasRecorrentes,
  hojeEmLisboa,
  listarAvisosDespesas,
  somarMesesISO,
  vencimentoDe,
  type DespesaLinha,
} from '@/lib/data/despesas'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import TituloSeccao from '@/components/TituloSeccao'
import CamposCategoria, { type CategoriaOpcao } from './CamposCategoria'
import { anularDespesa, guardarDespesa, marcarDespesaPaga } from './actions'
import {
  EtiquetaEstado,
  Mensagens,
  ROTA_DESPESAS,
  SeparadoresDespesas,
  botaoCls,
  botaoSecCls,
  carregarCategorias,
  dataPt,
  eur,
  inputCls,
  nomeMes,
} from './partes'

const COLUNAS =
  'id, estudio_id, data, categoria, subcategoria, descricao, valor, origem, pago, vencimento, pago_em, dias_aviso, recorrente_id'

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; estudio?: string; editar?: string; error?: string; ok?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return <PortaSenha titulo="Administração — Despesas" destino={ROTA_DESPESAS} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const hoje = hojeEmLisboa()
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : hoje.slice(0, 7)
  const inicio = `${mes}-01`
  const fim = dataNoMes(mes, 31)

  // As recorrentes entram no balanço sem esperar pelo cron.
  try {
    await gerarDespesasRecorrentes(supabase, hoje)
  } catch (e) {
    console.error('Despesas recorrentes não geradas:', e)
  }

  const todosEstudios = await getEstudios(supabase)
  const estudios = filtrarPorEstudio(todosEstudios, sp.estudio)
  const ids = estudios.map((e) => e.id)
  const nomeEstudio = new Map(todosEstudios.map((e) => [e.id, e.nome]))

  const [categorias, { data: linhasData, error }, avisosTodos, { data: emEdicaoData }] = await Promise.all([
    carregarCategorias(supabase),
    supabase
      .from('despesas')
      .select(COLUNAS)
      .in('estudio_id', ids)
      .is('anulado_em', null)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data')
      .order('criado_em'),
    listarAvisosDespesas(supabase, hoje),
    sp.editar
      ? supabase.from('despesas').select(COLUNAS).eq('id', sp.editar).is('anulado_em', null).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (error) throw new Error(error.message)

  const linhas = ((linhasData ?? []) as DespesaLinha[]).map((d) => ({ ...d, valor: Number(d.valor) }))
  const emEdicao = emEdicaoData ? ({ ...emEdicaoData, valor: Number(emEdicaoData.valor) } as DespesaLinha) : null
  const avisos = avisosTodos.filter((a) => ids.includes(a.estudio_id))
  const ordem = categorias.map((c) => c.nome)
  const balanco = balancoMes(linhas, hoje, ordem)

  const porCategoria = new Map<string, typeof linhas>()
  for (const d of linhas) {
    const lista = porCategoria.get(d.categoria) ?? []
    lista.push(d)
    porCategoria.set(d.categoria, lista)
  }

  const qsEstudio = sp.estudio ? `&estudio=${sp.estudio}` : ''
  const aqui = `${ROTA_DESPESAS}?mes=${mes}${qsEstudio}`
  const linkMes = (m: string) => `${ROTA_DESPESAS}?mes=${m}${qsEstudio}`
  const variosEstudios = estudios.length > 1

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Despesas</h1>
      <p className="mt-1 text-sm text-muted">
        Os gastos de {estudios.map((e) => e.nome).join(' + ')}, por categoria. As receitas vêm sempre dos pagamentos
        registados pelos instrutores — aqui só se lançam as despesas, que entram na análise do Financeiro.
      </p>

      <SeparadoresDespesas ativo={ROTA_DESPESAS} qs={sp.estudio ? `?estudio=${sp.estudio}` : ''} />
      <Mensagens error={sp.error} ok={sp.ok} />

      {avisos.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-amber-200">
            {avisos.length} despesa{avisos.length === 1 ? '' : 's'} a pagar ·{' '}
            {eur(avisos.reduce((s, a) => s + a.valor, 0))}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {avisos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                <EtiquetaEstado estado={a.estado} />
                <span className="font-semibold">{a.subcategoria ?? a.categoria}</span>
                {variosEstudios && <span className="text-xs text-muted">{nomeEstudio.get(a.estudio_id)}</span>}
                <span className="text-muted">
                  {a.estado === 'em_atraso' ? 'venceu a' : 'vence a'} {dataPt(a.vencimento)}
                </span>
                <span className="ml-auto font-mono font-bold">{eur(a.valor)}</span>
                <form action={marcarDespesaPaga}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="pago" value="true" />
                  <input type="hidden" name="voltar" value={aqui} />
                  <SubmitButton pendingText="…" className={botaoSecCls}>
                    Marcar paga
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mês */}
      <div className="mt-8 flex items-center gap-3">
        <Link href={linkMes(somarMesesISO(mes, -1))} className={botaoSecCls} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h2 className="min-w-44 text-center text-lg font-bold capitalize text-foreground">{nomeMes(mes)}</h2>
        <Link href={linkMes(somarMesesISO(mes, 1))} className={botaoSecCls} aria-label="Mês seguinte">
          <ChevronRight className="h-4 w-4" />
        </Link>
        {mes !== hoje.slice(0, 7) && (
          <Link href={linkMes(hoje.slice(0, 7))} className="text-xs font-semibold text-brand hover:underline">
            Voltar ao mês atual
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero label="Total do mês" valor={eur(balanco.total)} />
        <Numero label="Já pago" valor={eur(balanco.pago)} cor="text-emerald-300" />
        <Numero
          label="Por pagar"
          valor={eur(balanco.porPagar)}
          cor={balanco.porPagar > 0 ? 'text-amber-300' : undefined}
          nota={balanco.nPorPagar ? `${balanco.nPorPagar} despesa${balanco.nPorPagar === 1 ? '' : 's'}` : 'nada em falta'}
        />
        <Numero
          label="Em atraso"
          valor={eur(balanco.emAtraso)}
          cor={balanco.emAtraso > 0 ? 'text-red-300' : undefined}
          nota={balanco.nEmAtraso ? `${balanco.nEmAtraso} já venceu` : 'nada vencido'}
        />
      </div>

      {/* Lançar / editar */}
      <TituloSeccao cor="teal" id="lancar">
        {emEdicao ? 'Editar despesa' : 'Lançar despesa'}
      </TituloSeccao>
      <FormDespesa
        key={emEdicao?.id ?? 'nova'}
        categorias={categorias}
        estudios={todosEstudios.map((e) => ({ id: e.id, nome: e.nome }))}
        estudioOmissao={estudios[0]?.id}
        despesa={emEdicao}
        dataOmissao={mes === hoje.slice(0, 7) ? hoje : inicio}
        voltar={aqui}
      />

      {/* Balanço por categoria */}
      <TituloSeccao cor="roxo">Balanço de {nomeMes(mes)} por categoria</TituloSeccao>
      {balanco.porCategoria.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Ainda não há despesas neste mês.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2 font-semibold">Categoria</th>
                <th className="px-4 py-2 text-right font-semibold">Total</th>
                <th className="px-4 py-2 text-right font-semibold">Pago</th>
                <th className="px-4 py-2 text-right font-semibold">Por pagar</th>
              </tr>
            </thead>
            <tbody>
              {balanco.porCategoria.map((c) => (
                <tr key={c.categoria} className="border-b border-border-subtle/60 last:border-0">
                  <td className="px-4 py-2 text-foreground">{c.categoria}</td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">{eur(c.total)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{eur(c.pago)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${c.porPagar > 0 ? 'font-bold text-amber-300' : 'text-muted'}`}>
                    {eur(c.porPagar)}
                  </td>
                </tr>
              ))}
              <tr className="bg-brand/[.06] font-bold">
                <td className="px-4 py-2 text-foreground">Total</td>
                <td className="px-4 py-2 text-right font-mono text-foreground">{eur(balanco.total)}</td>
                <td className="px-4 py-2 text-right font-mono text-foreground">{eur(balanco.pago)}</td>
                <td className="px-4 py-2 text-right font-mono text-foreground">{eur(balanco.porPagar)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Lista */}
      <TituloSeccao cor="azul">Despesas de {nomeMes(mes)}</TituloSeccao>
      <div className="mt-2 flex flex-col gap-4">
        {balanco.porCategoria.map(({ categoria, total }) => (
          <div key={categoria} className="rounded-xl border border-border-subtle bg-surface">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
              <p className="text-sm font-bold text-foreground">{categoria}</p>
              <p className="font-mono text-sm font-bold text-foreground">{eur(total)}</p>
            </div>
            <ul>
              {(porCategoria.get(categoria) ?? []).map((d) => {
                const estado = estadoDespesa(d, hoje)
                const fixa = d.categoria === CATEGORIA_AJUSTE
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle/60 px-4 py-2 text-sm last:border-0"
                  >
                    <span className="w-20 shrink-0 font-mono text-xs text-muted">{dataPt(vencimentoDe(d))}</span>
                    <span className="min-w-40 flex-1 text-foreground">
                      {d.subcategoria ?? (fixa ? 'Acerto com o total do Excel' : '—')}
                      {d.descricao && <span className="text-muted"> · {d.descricao}</span>}
                      {d.recorrente_id && <span className="ml-1.5 text-[11px] font-semibold text-brand">recorrente</span>}
                      {variosEstudios && <span className="ml-1.5 text-[11px] text-muted">{nomeEstudio.get(d.estudio_id)}</span>}
                    </span>
                    {!fixa && <EtiquetaEstado estado={estado} />}
                    <span className="w-24 text-right font-mono font-semibold text-foreground">{eur(d.valor)}</span>
                    {!fixa && (
                      <span className="flex items-center gap-1.5">
                        <form action={marcarDespesaPaga}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="pago" value={d.pago ? 'false' : 'true'} />
                          <input type="hidden" name="voltar" value={aqui} />
                          <SubmitButton pendingText="…" className={botaoSecCls}>
                            {d.pago ? 'Por pagar' : 'Marcar paga'}
                          </SubmitButton>
                        </form>
                        <Link href={`${aqui}&editar=${d.id}#lancar`} className={botaoSecCls}>
                          Editar
                        </Link>
                        <ConfirmarAcao
                          action={anularDespesa}
                          confirmacao={`Anular esta despesa de ${eur(d.valor)}? Deixa de contar no balanço e no Financeiro.`}
                        >
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="voltar" value={aqui} />
                          <button type="submit" className="rounded-full px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10">
                            Anular
                          </button>
                        </ConfirmarAcao>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function Numero({ label, valor, cor, nota }: { label: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${cor ?? 'text-foreground'}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-muted">{nota}</p>}
    </div>
  )
}

function FormDespesa({
  categorias,
  estudios,
  estudioOmissao,
  despesa,
  dataOmissao,
  voltar,
}: {
  categorias: CategoriaOpcao[]
  estudios: { id: number; nome: string }[]
  estudioOmissao?: number
  despesa: DespesaLinha | null
  dataOmissao: string
  voltar: string
}) {
  const deRecorrente = !!despesa?.recorrente_id
  return (
    <form action={guardarDespesa} className="mt-2 rounded-xl border border-border-subtle bg-surface p-4">
      {despesa && <input type="hidden" name="id" value={despesa.id} />}
      <input type="hidden" name="voltar" value={voltar} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Estúdio
          <select name="estudio_id" defaultValue={despesa?.estudio_id ?? estudioOmissao} disabled={deRecorrente} className={inputCls}>
            {estudios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          {deRecorrente && <input type="hidden" name="estudio_id" value={despesa!.estudio_id} />}
        </label>
        <CamposCategoria
          categorias={categorias}
          categoriaInicial={despesa?.categoria ?? ''}
          subcategoriaInicial={despesa?.subcategoria ?? ''}
          className={inputCls}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Valor (€)
          <input name="valor" inputMode="decimal" required defaultValue={despesa ? String(despesa.valor).replace('.', ',') : ''} placeholder="0,00" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {deRecorrente ? 'Vencimento (definido pela recorrente)' : 'Data (ou data limite para pagar)'}
          <input
            type="date"
            name="data"
            required
            readOnly={deRecorrente}
            defaultValue={despesa ? vencimentoDe(despesa) : dataOmissao}
            className={`${inputCls} ${deRecorrente ? 'opacity-60' : ''}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
          Descrição (opcional)
          <input name="descricao" defaultValue={despesa?.descricao ?? ''} placeholder="Ex.: fatura de outubro" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Avisar quantos dias antes
          <input name="dias_aviso" type="number" min={0} max={60} defaultValue={despesa?.dias_aviso ?? 3} className={inputCls} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="pago" defaultChecked={despesa ? despesa.pago : true} className="h-4 w-4 accent-[var(--accent)]" />
          Já está paga
        </label>
        <span className="text-xs text-muted">
          Sem o visto, fica &quot;por pagar&quot; e aparece nos avisos uns dias antes da data.
        </span>
        <span className="ml-auto flex items-center gap-2">
          {despesa && (
            <Link href={voltar} className={botaoSecCls}>
              Cancelar
            </Link>
          )}
          <SubmitButton pendingText="A guardar…" className={botaoCls}>
            {despesa ? 'Guardar alterações' : 'Registar despesa'}
          </SubmitButton>
        </span>
      </div>
    </form>
  )
}
