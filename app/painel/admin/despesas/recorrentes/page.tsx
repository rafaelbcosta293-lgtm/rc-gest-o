import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import {
  PERIODICIDADES,
  hojeEmLisboa,
  proximoVencimento,
  somarMesesISO,
  subtrairDias,
  sugerirRecorrentes,
  vencimentosEntre,
  type DespesaRecorrente,
} from '@/lib/data/despesas'
import { desbloquearAdmin } from '../../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import TituloSeccao from '@/components/TituloSeccao'
import CamposCategoria from '../CamposCategoria'
import { alternarRecorrente, eliminarRecorrente, guardarRecorrente } from '../actions'
import {
  Mensagens,
  ROTA_DESPESAS,
  SeparadoresDespesas,
  botaoCls,
  botaoSecCls,
  carregarCategorias,
  dataPt,
  eur,
  inputCls,
} from '../partes'

const ROTA = `${ROTA_DESPESAS}/recorrentes`

export default async function RecorrentesPage({
  searchParams,
}: {
  searchParams: Promise<{
    estudio?: string
    editar?: string
    error?: string
    ok?: string
    erroSenha?: string
    // Pré-preenchimento a partir de uma sugestão.
    s_estudio?: string
    s_categoria?: string
    s_sub?: string
    s_valor?: string
  }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return <PortaSenha titulo="Administração — Despesas recorrentes" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const hoje = hojeEmLisboa()
  const mesAtual = hoje.slice(0, 7)
  const todosEstudios = await getEstudios(supabase)
  const estudios = filtrarPorEstudio(todosEstudios, sp.estudio)
  const ids = estudios.map((e) => e.id)
  const nomeEstudio = new Map(todosEstudios.map((e) => [e.id, e.nome]))

  const [categorias, { data: recsData, error }, historico] = await Promise.all([
    carregarCategorias(supabase),
    supabase.from('despesas_recorrentes').select('*').in('estudio_id', ids).order('ativo', { ascending: false }).order('dia_vencimento'),
    todasAsLinhas<{ estudio_id: number; data: string; categoria: string; subcategoria: string | null; valor: number | string }>(
      (de, ate) =>
        supabase
          .from('despesas')
          .select('estudio_id, data, categoria, subcategoria, valor')
          .in('estudio_id', ids)
          .is('anulado_em', null)
          .is('recorrente_id', null)
          .gte('data', `${somarMesesISO(mesAtual, -12)}-01`)
          .order('id')
          .range(de, ate)
    ),
  ])
  if (error) throw new Error(error.message)

  const recs = ((recsData ?? []) as DespesaRecorrente[]).map((r) => ({ ...r, valor: Number(r.valor) }))
  const emEdicao = sp.editar ? (recs.find((r) => r.id === sp.editar) ?? null) : null
  const sugestoes = sugerirRecorrentes(
    historico.data.map((d) => ({ ...d, valor: Number(d.valor) })),
    mesAtual,
    recs
  ).slice(0, 12)

  const qs = sp.estudio ? `?estudio=${sp.estudio}` : ''
  const aqui = `${ROTA}${qs}`
  const variosEstudios = estudios.length > 1
  const ativas = recs.filter((r) => r.ativo)
  const totalMensal = ativas.reduce((s, r) => s + r.valor / (PERIODICIDADES.find((p) => p.valor === r.periodicidade)?.meses ?? 1), 0)

  const inicial = emEdicao ?? {
    estudio_id: Number(sp.s_estudio) || estudios[0]?.id,
    categoria: sp.s_categoria ?? '',
    subcategoria: sp.s_sub ?? '',
    descricao: '',
    valor: sp.s_valor ? Number(sp.s_valor) : null,
    periodicidade: 'mensal',
    dia_vencimento: 8,
    inicio: proximoVencimento(8, hoje),
    fim: null,
    dias_aviso: 3,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Despesas recorrentes e avisos</h1>
      <p className="mt-1 text-sm text-muted">
        Renda ou prestação, impostos, salários, serviços… Define o valor, o dia de pagamento e com quantos dias de
        antecedência queres ser avisado. Cada vencimento entra sozinho no balanço do mês como &quot;por pagar&quot; e
        o aviso aparece no topo da Administração até marcares a despesa como paga.
      </p>

      <SeparadoresDespesas ativo={ROTA} qs={qs} />
      <Mensagens error={sp.error} ok={sp.ok} />

      <TituloSeccao cor="teal" id="form">
        {emEdicao ? 'Editar despesa recorrente' : 'Nova despesa recorrente'}
      </TituloSeccao>
      <form
        key={emEdicao?.id ?? `${sp.s_categoria ?? ''}|${sp.s_sub ?? ''}`}
        action={guardarRecorrente}
        className="mt-2 rounded-xl border border-border-subtle bg-surface p-4"
      >
        {emEdicao && <input type="hidden" name="id" value={emEdicao.id} />}
        <input type="hidden" name="voltar" value={aqui} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Estúdio
            <select name="estudio_id" defaultValue={inicial.estudio_id} className={inputCls}>
              {todosEstudios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
          <CamposCategoria
            categorias={categorias}
            categoriaInicial={inicial.categoria}
            subcategoriaInicial={inicial.subcategoria ?? ''}
            className={inputCls}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Valor previsto (€)
            <input
              name="valor"
              inputMode="decimal"
              required
              defaultValue={inicial.valor != null ? String(inicial.valor).replace('.', ',') : ''}
              placeholder="0,00"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Repete
            <select name="periodicidade" defaultValue={inicial.periodicidade} className={inputCls}>
              {PERIODICIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Dia de pagamento (1–31)
            <input name="dia_vencimento" type="number" min={1} max={31} required defaultValue={inicial.dia_vencimento} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Avisar quantos dias antes
            <input name="dias_aviso" type="number" min={0} max={60} required defaultValue={inicial.dias_aviso} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Primeiro vencimento
            <input name="inicio" type="date" required defaultValue={inicial.inicio} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
            Descrição (opcional)
            <input name="descricao" defaultValue={inicial.descricao ?? ''} placeholder="Ex.: prestação do empréstimo" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Termina em (opcional)
            <input name="fim" type="date" defaultValue={inicial.fim ?? ''} className={inputCls} />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">
          O valor é uma previsão: quando a fatura chegar com outro valor, edita essa despesa no mês. Nas repetições que
          não são mensais (IVA trimestral, seguro anual…), o ciclo conta a partir do mês do primeiro vencimento.
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          {(emEdicao || sp.s_categoria) && (
            <Link href={aqui} className={botaoSecCls}>
              Cancelar
            </Link>
          )}
          <SubmitButton pendingText="A guardar…" className={botaoCls}>
            {emEdicao ? 'Guardar alterações' : 'Criar despesa recorrente'}
          </SubmitButton>
        </div>
      </form>

      <TituloSeccao cor="roxo">As tuas despesas recorrentes</TituloSeccao>
      {recs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Ainda não tens nenhuma. Cria a primeira acima ou parte de uma das sugestões abaixo.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            {ativas.length} ativa{ativas.length === 1 ? '' : 's'} · cerca de {eur(totalMensal)} por mês.
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-2 font-semibold">Despesa</th>
                  <th className="px-4 py-2 font-semibold">Repete</th>
                  <th className="px-4 py-2 font-semibold">Próximo vencimento</th>
                  <th className="px-4 py-2 font-semibold">Aviso</th>
                  <th className="px-4 py-2 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => {
                  const proximo = r.ativo ? vencimentosEntre(r, hoje, `${somarMesesISO(mesAtual, 13)}-01`)[0] : undefined
                  return (
                    <tr key={r.id} className={`border-b border-border-subtle/60 last:border-0 ${r.ativo ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-2 text-foreground">
                        <span className="font-semibold">{r.subcategoria ?? r.categoria}</span>
                        <span className="block text-xs text-muted">
                          {r.categoria}
                          {r.descricao ? ` · ${r.descricao}` : ''}
                          {variosEstudios ? ` · ${nomeEstudio.get(r.estudio_id)}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {PERIODICIDADES.find((p) => p.valor === r.periodicidade)?.rotulo}, dia {r.dia_vencimento}
                      </td>
                      <td className="px-4 py-2 text-foreground">{!r.ativo ? 'Parada' : proximo ? dataPt(proximo) : 'Terminou'}</td>
                      <td className="px-4 py-2 text-muted">
                        {r.dias_aviso === 0 ? 'no próprio dia' : `${r.dias_aviso} dia${r.dias_aviso === 1 ? '' : 's'} antes`}
                        {proximo && <span className="block text-xs">a {dataPt(subtrairDias(proximo, r.dias_aviso))}</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-foreground">{eur(r.valor)}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center justify-end gap-1.5">
                          <Link href={`${aqui}${qs ? '&' : '?'}editar=${r.id}#form`} className={botaoSecCls}>
                            Editar
                          </Link>
                          <form action={alternarRecorrente}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="ativo" value={r.ativo ? 'false' : 'true'} />
                            <input type="hidden" name="voltar" value={aqui} />
                            <SubmitButton pendingText="…" className={botaoSecCls}>
                              {r.ativo ? 'Parar' : 'Reativar'}
                            </SubmitButton>
                          </form>
                          <ConfirmarAcao
                            action={eliminarRecorrente}
                            confirmacao="Eliminar esta despesa recorrente? As ocorrências já pagas ficam nas contas; as futuras por pagar são anuladas."
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="voltar" value={aqui} />
                            <button type="submit" className="rounded-full px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10">
                              Eliminar
                            </button>
                          </ConfirmarAcao>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sugestoes.length > 0 && (
        <>
          <TituloSeccao cor="ambar">Sugestões a partir do histórico</TituloSeccao>
          <p className="mt-1 text-xs text-muted">
            Despesas que apareceram em pelo menos 6 dos últimos 12 meses e ainda não são recorrentes. Carrega em
            &quot;Usar&quot; para preencher o formulário com o valor médio — só fica criada depois de confirmares o dia e o aviso.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sugestoes.map((s) => {
              const params = new URLSearchParams({
                ...(sp.estudio ? { estudio: sp.estudio } : {}),
                s_estudio: String(s.estudio_id),
                s_categoria: s.categoria,
                s_sub: s.subcategoria,
                s_valor: String(s.valorMedio),
              })
              return (
                <div key={`${s.estudio_id}|${s.categoria}|${s.subcategoria}`} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.subcategoria}</p>
                    <p className="truncate text-xs text-muted">
                      {s.categoria}
                      {variosEstudios ? ` · ${nomeEstudio.get(s.estudio_id)}` : ''} · {s.meses} de 12 meses
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-foreground">{eur(s.valorMedio)}</span>
                  <Link href={`${ROTA}?${params.toString()}#form`} className={botaoSecCls}>
                    Usar
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
