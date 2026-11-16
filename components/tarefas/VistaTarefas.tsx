import Link from '@/components/LinkRapido'
import { ArrowLeft, Check, Play, Star, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { getEstudios } from '@/lib/data/estudios'
import { hojeEmLisboa } from '@/lib/data/hoje'
import {
  agruparTarefas,
  carregarDetalheTarefa,
  carregarTarefas,
  carregarTarefasFeitas,
  DIAS_FEITAS_VISIVEIS,
  emFoco,
  escolhaDeRepeticao,
  estatisticasTarefas,
  filtrarTarefas,
  MAX_FOCO_POR_PESSOA,
  pessoasParaTarefas,
  PRIORIDADES,
  type ComentarioTarefa,
  type Tarefa,
} from '@/lib/data/tarefas'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import {
  alternarSubtarefa,
  apagarComentario,
  atualizarTarefa,
  comentarTarefa,
  criarSubtarefa,
  criarTarefa,
  eliminarSubtarefa,
  eliminarTarefa,
} from '@/app/painel/tarefasActions'
import CamposEstado from './CamposEstado'
import CamposRepeticao from './CamposRepeticao'
import ConcluirTarefa from './ConcluirTarefa'
import EditarComBotaoDireito from './EditarComBotaoDireito'
import CalendarioTarefas, { ESCALAS, type Escala } from './CalendarioTarefas'
import PainelTarefas from './PainelTarefas'
import { botaoPequenoCls, CabecalhoLista, campoCls, dataCurta, EstadoForm, horaCurta, LinhaTarefa, Pastilhas, rotuloCls, type Contexto } from './partes'

// O ecrã das Tarefas — o mesmo em cada estúdio, na Coordenação e na
// Administração (só muda o endereço de base e o tema). Dentro de um
// estúdio veem-se só as tarefas desse estúdio e as da empresa toda; na
// Coordenação e na Administração, todas. Usa apenas as cores do tema e
// variantes "dark:", por isso lê-se bem nas áreas claras e na escura.

export type ParametrosTarefas = {
  vista?: string
  pessoa?: string
  estudio?: string
  lista?: string
  editar?: string
  // Calendário: escala (dia, semana, mês, ano), dia de referência e se
  // mostra as tarefas que se repetem ("0" esconde).
  cal?: string
  data?: string
  rotinas?: string
  ok?: string
  error?: string
}

const MENSAGENS_OK: Record<string, string> = {
  criada: 'Tarefa criada.',
  guardada: 'Tarefa guardada.',
  concluida: 'Tarefa concluída.',
  'em-curso': 'Tarefa em curso.',
  reaberta: 'Tarefa reaberta.',
  foco: 'Tarefa no foco desta semana.',
  'sem-foco': 'Tarefa retirada do foco.',
  eliminada: 'Tarefa eliminada.',
}

// A primeira é a que abre por omissão: o calendário (na semana).
const VISTA_OMISSAO = 'calendario'
const VISTAS = [
  { id: 'calendario', rotulo: 'Calendário' },
  { id: 'lista', rotulo: 'Lista' },
  { id: 'quadro', rotulo: 'Quadro' },
  { id: 'pessoas', rotulo: 'Por pessoa' },
  { id: 'painel', rotulo: 'Painel' },
]

function Seccao({
  titulo,
  nota,
  tarefas,
  ctx,
  vazio,
  destaque,
}: {
  titulo: string
  nota?: string
  tarefas: Tarefa[]
  ctx: Contexto
  vazio?: string
  destaque?: 'foco' | 'urgente'
}) {
  if (tarefas.length === 0 && !vazio) return null
  return (
    <section>
      <h2
        className={`text-xs font-semibold uppercase tracking-wider ${
          destaque === 'urgente' && tarefas.length ? 'text-red-700 dark:text-red-300' : 'text-muted'
        }`}
      >
        {titulo} ({tarefas.length})
      </h2>
      {nota && <p className="mt-0.5 text-xs text-muted">{nota}</p>}
      {tarefas.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-border-subtle px-3 py-4 text-sm text-muted">{vazio}</p>
      ) : (
        <ul className={`mt-2 divide-y divide-border-subtle/60 rounded-xl border bg-surface ${destaque === 'foco' ? 'border-brand' : 'border-border-subtle'}`}>
          {tarefas.map((t) => (
            <LinhaTarefa key={t.id} t={t} ctx={ctx} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CartaoQuadro({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  return (
    <EditarComBotaoDireito href={ctx.linkEditar(t.id)} className="rounded-lg border border-border-subtle bg-surface p-3">
      <Link
        href={ctx.linkEditar(t.id)}
        className={`text-sm font-semibold text-foreground hover:underline ${t.estado === 'feito' ? 'line-through opacity-60' : ''}`}
      >
        {emFoco(t, ctx.hoje) && <Star className="mr-1 inline h-3.5 w-3.5 text-brand" fill="currentColor" />}
        {t.titulo}
      </Link>
      <Pastilhas t={t} ctx={ctx} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {t.estado === 'por_fazer' && (
          <EstadoForm id={t.id} estado="em_curso" voltar={ctx.voltar}>
            <button type="submit" className={botaoPequenoCls}>
              <Play className="mr-1 inline h-3 w-3" />
              Começar
            </button>
          </EstadoForm>
        )}
        {t.estado === 'em_curso' && (
          <EstadoForm id={t.id} estado="por_fazer" voltar={ctx.voltar}>
            <button type="submit" className={botaoPequenoCls}>
              Parar
            </button>
          </EstadoForm>
        )}
        <ConcluirTarefa id={t.id} titulo={t.titulo} voltar={ctx.voltar} feita={t.estado === 'feito'} pessoas={ctx.pessoas} euId={ctx.euId} variante="botao" />
      </div>
    </EditarComBotaoDireito>
  )
}

function CamposTarefa({
  tarefa,
  pessoas,
  estudios,
  listas,
  podeReservar,
  padrao,
}: {
  tarefa?: Tarefa
  pessoas: { id: string; nome: string }[]
  // Os estúdios que se podem escolher (dentro de um estúdio, só esse).
  estudios: { id: number; nome: string }[]
  listas: string[]
  podeReservar: boolean
  padrao?: { responsavelId?: string; estudioId?: number }
}) {
  const maisAberto = !!tarefa && (!!tarefa.responsavel_id || !!tarefa.inicio || !!tarefa.prioridade || tarefa.etiquetas.length > 0 || tarefa.reservada)
  return (
    <>
      <input
        name="titulo"
        required
        defaultValue={tarefa?.titulo ?? ''}
        placeholder="O que é para fazer? Ex.: Regar as plantas, ligar ao fornecedor das máquinas"
        className={campoCls}
      />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <label className={rotuloCls}>
          Prazo (opcional)
          <input type="date" name="prazo" defaultValue={tarefa?.prazo ?? ''} className={campoCls} />
        </label>
        <label className={rotuloCls}>
          Hora (opcional)
          <input type="time" name="hora" defaultValue={horaCurta(tarefa?.hora ?? null)} className={campoCls} />
        </label>
        <label className={rotuloCls}>
          Lista (opcional)
          <input name="lista" list="listas-de-tarefas" defaultValue={tarefa?.lista ?? ''} placeholder="Ex.: Limpeza, Manutenção" className={campoCls} />
          <datalist id="listas-de-tarefas">
            {listas.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
        <label className={rotuloCls}>
          Estúdio
          <select name="estudio_id" defaultValue={tarefa ? (tarefa.estudio_id ?? '') : (padrao?.estudioId ?? '')} className={campoCls}>
            {estudios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
            <option value="">Empresa toda (aparece nos dois estúdios)</option>
          </select>
        </label>
      </div>
      <CamposRepeticao
        key={tarefa?.id ?? 'nova'}
        inicial={{
          escolha: tarefa ? escolhaDeRepeticao(tarefa) : 'nao',
          dias: tarefa?.repete_dias ?? [],
          intervalo: tarefa?.repete_intervalo ?? 1,
          aposDias: tarefa?.repete_apos_dias ?? null,
          ate: tarefa?.repete_ate ?? null,
        }}
        campoCls={campoCls}
        rotuloCls={rotuloCls}
      />
      <textarea
        name="descricao"
        rows={tarefa?.descricao ? 4 : 2}
        defaultValue={tarefa?.descricao ?? ''}
        placeholder="Detalhes (opcional)"
        className={campoCls}
      />
      <details open={maisAberto} className="rounded-lg border border-border-subtle">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted">
          Mais opções — responsável, data de início, prioridade, etiquetas
        </summary>
        <div className="flex flex-col gap-2.5 border-t border-border-subtle p-3">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <label className={rotuloCls}>
              Responsável (opcional)
              <select name="responsavel_id" defaultValue={tarefa ? (tarefa.responsavel_id ?? '') : (padrao?.responsavelId ?? '')} className={campoCls}>
                <option value="">Sem responsável</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className={rotuloCls}>
              Início (opcional)
              <input type="date" name="inicio" defaultValue={tarefa?.inicio ?? ''} className={campoCls} />
            </label>
            <label className={rotuloCls}>
              Prioridade
              <select name="prioridade" defaultValue={tarefa?.prioridade ?? ''} className={campoCls}>
                <option value="">Sem prioridade</option>
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className={rotuloCls}>
              Etiquetas (separadas por vírgulas)
              <input name="etiquetas" defaultValue={tarefa?.etiquetas.join(', ') ?? ''} placeholder="Ex.: limpeza, urgente" className={campoCls} />
            </label>
          </div>
          <p className="text-xs text-muted">
            Por norma as tarefas não têm responsável: quem a fizer indica o nome ao concluir. O início serve para tarefas que demoram vários dias.
          </p>
          {podeReservar && (
            <label className="flex items-center gap-2 text-xs font-medium text-muted">
              <input type="checkbox" name="reservada" value="1" defaultChecked={tarefa?.reservada ?? false} className="h-4 w-4" />
              Só a administração vê esta tarefa (salários, avaliações, assuntos de gestão)
            </label>
          )}
        </div>
      </details>
    </>
  )
}

const quando = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

// Os passos (subtarefas) e os comentários da tarefa aberta.
function DetalheTarefa({
  tarefa,
  passos,
  comentarios,
  ctx,
  podeApagar,
}: {
  tarefa: Tarefa
  passos: Tarefa[]
  comentarios: ComentarioTarefa[]
  ctx: Contexto
  // Pode apagar este comentário? (a gestão, ou quem o escreveu)
  podeApagar: (c: ComentarioTarefa) => boolean
}) {
  const feitos = passos.filter((p) => p.estado === 'feito').length
  const ocultos = (
    <>
      <input type="hidden" name="voltar" value={ctx.voltar} />
      <input type="hidden" name="manter" value="1" />
    </>
  )
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border-subtle pt-4 lg:grid-cols-2">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Passos {passos.length > 0 && `(${feitos}/${passos.length})`}</h3>
        {passos.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {passos.map((p) => {
              const feito = p.estado === 'feito'
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-foreground/[.04]">
                  <form action={alternarSubtarefa} className="shrink-0">
                    {ocultos}
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="tarefa_mae_id" value={tarefa.id} />
                    <input type="hidden" name="feita" value={feito ? '0' : '1'} />
                    <button
                      type="submit"
                      aria-label={feito ? `Desmarcar: ${p.titulo}` : `Marcar como feito: ${p.titulo}`}
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                        feito
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-border-strong text-transparent hover:border-emerald-600 hover:text-emerald-600'
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </button>
                  </form>
                  <span className={`min-w-0 flex-1 text-sm text-foreground ${feito ? 'line-through opacity-60' : ''}`}>{p.titulo}</span>
                  <form action={eliminarSubtarefa} className="shrink-0">
                    {ocultos}
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="tarefa_mae_id" value={tarefa.id} />
                    <button
                      type="submit"
                      aria-label={`Remover o passo: ${p.titulo}`}
                      title="Remover"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
        <form action={criarSubtarefa} className="mt-2 flex gap-2">
          {ocultos}
          <input type="hidden" name="tarefa_mae_id" value={tarefa.id} />
          <input name="titulo" required placeholder="Acrescentar um passo…" className={campoCls} />
          <SubmitButton
            pendingText="…"
            className="shrink-0 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-brand/[.08]"
          >
            Juntar
          </SubmitButton>
        </form>
        {repeteNota(tarefa) && <p className="mt-1.5 text-xs text-muted">Como a tarefa se repete, os passos voltam por fazer na vez seguinte.</p>}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Comentários {comentarios.length > 0 && `(${comentarios.length})`}</h3>
        {comentarios.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-lg bg-foreground/[.04] px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {c.autor_nome ?? (c.autor_id ? ctx.nomePessoa.get(c.autor_id) : null) ?? 'Conta do estúdio'}
                    <span className="ml-1.5 font-normal text-muted">{quando.format(new Date(c.criado_em))}</span>
                  </span>
                  {podeApagar(c) && (
                    <form action={apagarComentario}>
                      {ocultos}
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="tarefa_id" value={tarefa.id} />
                      <button type="submit" className="text-[11px] font-semibold text-muted underline hover:text-foreground">
                        apagar
                      </button>
                    </form>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.texto}</p>
              </li>
            ))}
          </ul>
        )}
        <form action={comentarTarefa} className="mt-2 flex flex-col gap-2">
          {ocultos}
          <input type="hidden" name="tarefa_id" value={tarefa.id} />
          <textarea name="texto" required rows={2} placeholder="Escrever um comentário…" className={campoCls} />
          <div className="flex flex-wrap items-center gap-2">
            {ctx.euId ? (
              <input type="hidden" name="autor" value={ctx.euId} />
            ) : (
              <select name="autor" required defaultValue="" aria-label="Quem escreve" className={`${campoCls} max-w-52`}>
                <option value="">Quem escreve…</option>
                {ctx.pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-brand/[.08]"
            >
              Comentar
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  )
}

const repeteNota = (t: Tarefa) => escolhaDeRepeticao(t) !== 'nao'

export default async function VistaTarefas({
  base,
  sp,
  estudioSlug,
  voltarPara,
}: {
  // Endereço desta página, ex.: "/painel/fatima/tarefas".
  base: string
  sp: ParametrosTarefas
  // Num estúdio: as tarefas novas ficam, por omissão, desse estúdio.
  estudioSlug?: string
  voltarPara?: { href: string; rotulo: string }
}) {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const verPainel = sp.vista === 'painel'
  const [sessao, comPassos, pessoas, estudios, feitasRecentes, detalhe] = await Promise.all([
    getSessaoAtual(),
    carregarTarefas(supabase, hoje),
    pessoasParaTarefas(),
    getEstudios(supabase),
    // Só o painel precisa do histórico das concluídas.
    verPainel ? carregarTarefasFeitas(supabase, hoje) : Promise.resolve([]),
    // Os passos e os comentários da tarefa aberta.
    sp.editar ? carregarDetalheTarefa(supabase, sp.editar) : Promise.resolve(null),
  ])
  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)

  // Dentro de um estúdio: só as tarefas desse estúdio e as da empresa
  // toda — as do outro estúdio não aparecem.
  const estudioDaqui = estudioSlug ? estudios.find((e) => e.slug === estudioSlug) : undefined
  // Os passos (subtarefas) não são linhas da lista: contam-se na tarefa.
  const principais = comPassos.filter((t) => !t.tarefa_mae_id)
  const todas = estudioDaqui ? filtrarTarefas(principais, { doEstudio: estudioDaqui.id }) : principais
  const passos = new Map<string, { total: number; feitos: number }>()
  for (const p of comPassos) {
    if (!p.tarefa_mae_id) continue
    const conta = passos.get(p.tarefa_mae_id) ?? passos.set(p.tarefa_mae_id, { total: 0, feitos: 0 }).get(p.tarefa_mae_id)!
    conta.total++
    if (p.estado === 'feito') conta.feitos++
  }

  // Numa conta pessoal sabe-se quem é: conclui (e comenta) em nome dela.
  // Nas contas partilhadas (estúdios, Coordenação) escolhe-se o nome.
  const euId = sessao.userId && !ehContaFixa(sessao.email) && pessoas.some((p) => p.id === sessao.userId) ? sessao.userId : null
  // Por norma as tarefas não têm responsável — o filtro "Quem" e a vista
  // "Por pessoa" só aparecem quando alguma tem.
  const haResponsaveis = todas.some((t) => t.responsavel_id && t.estado !== 'feito')
  const pessoa = sp.pessoa === 'todas' ? undefined : sp.pessoa
  const vista = VISTAS.some((v) => v.id === sp.vista) ? sp.vista! : VISTA_OMISSAO
  const estudioFiltro = estudioDaqui ? undefined : sp.estudio === 'geral' ? ('geral' as const) : estudios.find((e) => e.slug === sp.estudio)?.id
  const listas = [...new Set(todas.map((t) => t.lista).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b, 'pt'))

  const link = (extra: Partial<ParametrosTarefas> = {}) => {
    const valores: Partial<ParametrosTarefas> = {
      vista: vista === VISTA_OMISSAO ? undefined : vista,
      pessoa: sp.pessoa,
      estudio: sp.estudio,
      lista: sp.lista,
      // O calendário mantém a escala e o dia ao concluir uma tarefa ou ao filtrar.
      ...(vista === 'calendario' ? { cal: sp.cal, data: sp.data, rotinas: sp.rotinas } : {}),
      ...extra,
    }
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(valores)) if (v) qs.set(k, v)
    const texto = qs.toString()
    return texto ? `${base}?${texto}` : base
  }
  const voltar = link()
  const ctx: Contexto = {
    hoje,
    voltar,
    nomePessoa: new Map(pessoas.map((p) => [p.id, p.nome])),
    nomeEstudio: new Map(estudios.map((e) => [e.id, e.nome])),
    linkEditar: (id) => `${link({ editar: id })}#editar`,
    pessoas,
    euId,
    passos,
    mostrarEstudio: !estudioDaqui,
  }

  const escala: Escala = ESCALAS.some((e) => e.id === sp.cal) ? (sp.cal as Escala) : 'semana'
  const dataCalendario = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? '') ? sp.data! : hoje

  // "Por pessoa" mostra sempre a equipa toda; as outras vistas respeitam
  // o filtro de pessoa.
  const semPessoa = filtrarTarefas(todas, {
    estudioId: estudioFiltro,
    lista: sp.lista,
  })
  const visiveis = filtrarTarefas(semPessoa, { pessoa })
  const grupos = agruparTarefas(visiveis, hoje)
  const emEdicao = sp.editar ? todas.find((t) => t.id === sp.editar) : undefined
  if (emEdicao && detalhe) {
    // Para a tarefa aberta conta-se pelos passos lidos agora (inclui os feitos há muito).
    if (detalhe.passos.length > 0)
      passos.set(emEdicao.id, {
        total: detalhe.passos.length,
        feitos: detalhe.passos.filter((p) => p.estado === 'feito').length,
      })
  }
  const abertas = visiveis.filter((t) => t.estado !== 'feito')
  const atrasadas = grupos.urgentes.filter((t) => t.prazo! < hoje)
  const paraHoje = grupos.urgentes.filter((t) => t.prazo === hoje)
  const vistas = VISTAS.filter((v) => v.id !== 'pessoas' || haResponsaveis || vista === 'pessoas')
  const estudiosDoFormulario = estudioDaqui ? [estudioDaqui] : estudios

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
      ativo ? 'bg-brand text-black' : 'border border-border-subtle bg-surface text-foreground hover:bg-brand/[.08]'
    }`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {voltarPara && (
        <Link href={voltarPara.href} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {voltarPara.rotulo}
        </Link>
      )}
      <div className={`flex flex-wrap items-end justify-between gap-3 ${voltarPara ? 'mt-3' : ''}`}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm text-muted">
            {estudioDaqui ? `As tarefas de ${estudioDaqui.nome} e as da empresa toda.` : 'As tarefas dos dois estúdios e as da empresa toda.'} Para concluir uma
            tarefa indica-se quem a fez. As que não têm prazo ficam em “Para ir fazendo”; a estrela põe uma tarefa no foco da semana (até {MAX_FOCO_POR_PESSOA}{' '}
            de cada vez).
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1">
          {vistas.map((v) => (
            <Link
              key={v.id}
              href={link({
                vista: v.id === VISTA_OMISSAO ? undefined : v.id,
                editar: undefined,
              })}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                v.id === vista ? 'bg-brand text-black' : 'text-muted hover:text-foreground'
              }`}
            >
              {v.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {sp.error && <p className="mt-4 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{sp.error}</p>}
      {sp.ok && MENSAGENS_OK[sp.ok] && (
        <p className="mt-4 rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">{MENSAGENS_OK[sp.ok]}</p>
      )}

      {/* Filtros */}
      <div className="mt-5 flex flex-col gap-2">
        {vista !== 'pessoas' && vista !== 'painel' && (haResponsaveis || pessoa) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 text-xs font-semibold uppercase tracking-wider text-muted">Quem</span>
            <Link href={link({ pessoa: undefined, editar: undefined })} className={chip(!pessoa)}>
              Todos
            </Link>
            {pessoas.map((p) => (
              <Link key={p.id} href={link({ pessoa: p.id, editar: undefined })} className={chip(pessoa === p.id)}>
                {p.nome.split(' ')[0]}
              </Link>
            ))}
            <Link href={link({ pessoa: 'sem', editar: undefined })} className={chip(pessoa === 'sem')}>
              Sem responsável
            </Link>
          </div>
        )}
        {!estudioDaqui && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 text-xs font-semibold uppercase tracking-wider text-muted">Estúdio</span>
            <Link href={link({ estudio: undefined, editar: undefined })} className={chip(!sp.estudio)}>
              Todos
            </Link>
            {estudios.map((e) => (
              <Link key={e.id} href={link({ estudio: e.slug, editar: undefined })} className={chip(sp.estudio === e.slug)}>
                {e.nome}
              </Link>
            ))}
            <Link href={link({ estudio: 'geral', editar: undefined })} className={chip(sp.estudio === 'geral')}>
              Empresa toda
            </Link>
          </div>
        )}
        {listas.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 text-xs font-semibold uppercase tracking-wider text-muted">Lista</span>
            <Link href={link({ lista: undefined, editar: undefined })} className={chip(!sp.lista)}>
              Todas
            </Link>
            {listas.map((l) => (
              <Link key={l} href={link({ lista: l, editar: undefined })} className={chip(sp.lista === l)}>
                {l}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Nova tarefa / editar */}
      {emEdicao ? (
        <section key={emEdicao.id} id="editar" className="mt-5 scroll-mt-24 rounded-xl border border-brand bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">Editar tarefa</h2>
            <Link href={link({ editar: undefined })} className="text-xs font-semibold text-muted underline hover:text-foreground">
              Fechar
            </Link>
          </div>
          <form action={atualizarTarefa} className="mt-3 flex flex-col gap-2.5">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="voltar" value={voltar} />
            <CamposTarefa tarefa={emEdicao} pessoas={pessoas} estudios={estudiosDoFormulario} listas={listas} podeReservar={ehAdmin} />
            <CamposEstado
              estadoInicial={emEdicao.estado}
              feitaPorInicial={emEdicao.feita_por ?? euId ?? ''}
              pessoas={pessoas}
              campoCls={campoCls}
              rotuloCls={rotuloCls}
            />
            <SubmitButton pendingText="A guardar…" className="self-start rounded-full bg-brand px-5 py-2 text-sm font-bold text-black hover:bg-brand-strong">
              Guardar
            </SubmitButton>
          </form>
          <DetalheTarefa
            tarefa={emEdicao}
            passos={detalhe?.passos ?? []}
            comentarios={detalhe?.comentarios ?? []}
            ctx={ctx}
            podeApagar={(c) => ehGestao || (!!sessao.userId && c.autor_id === sessao.userId)}
          />
          {ehGestao && (
            <ConfirmarAcao action={eliminarTarefa} confirmacao={`Eliminar "${emEdicao.titulo}" de vez? Se já está feita, basta concluí-la.`} className="mt-4">
              <input type="hidden" name="id" value={emEdicao.id} />
              <input type="hidden" name="voltar" value={voltar} />
              <button type="submit" className="text-xs font-semibold text-red-700 underline dark:text-red-300">
                Eliminar esta tarefa
              </button>
            </ConfirmarAcao>
          )}
        </section>
      ) : (
        // Fechado por omissão: no telemóvel o formulário aberto empurrava a
        // lista para fora do ecrã.
        <details className="group mt-5 rounded-xl border border-border-subtle bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-base leading-none text-black group-open:rotate-45">+</span>
            Nova tarefa
          </summary>
          <form action={criarTarefa} className="flex flex-col gap-2.5 border-t border-border-subtle p-4">
            <input type="hidden" name="voltar" value={voltar} />
            <CamposTarefa
              pessoas={pessoas}
              estudios={estudiosDoFormulario}
              listas={listas}
              podeReservar={ehAdmin}
              padrao={{
                responsavelId: pessoa && pessoa !== 'sem' ? pessoa : undefined,
                estudioId: estudioDaqui?.id ?? (typeof estudioFiltro === 'number' ? estudioFiltro : undefined),
              }}
            />
            <p className="text-xs text-muted">Depois de criada, abre a tarefa (toca no título) para lhe juntar passos e comentários.</p>
            <SubmitButton pendingText="A guardar…" className="self-start rounded-full bg-brand px-5 py-2 text-sm font-bold text-black hover:bg-brand-strong">
              Adicionar tarefa
            </SubmitButton>
          </form>
        </details>
      )}

      {/* Lista */}
      {vista === 'lista' && (
        <div className="mt-6 flex flex-col gap-6">
          {abertas.length === 0 && grupos.feitas.length === 0 && (
            <p className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
              Ainda não há tarefas
              {pessoa || sp.estudio || sp.lista ? ' com estes filtros' : ''}. Cria a primeira em cima.
            </p>
          )}
          {(abertas.length > 0 || grupos.feitas.length > 0) && (
            <div className="-mb-4">
              <CabecalhoLista />
            </div>
          )}
          <Seccao titulo="Foco desta semana" nota="As tarefas escolhidas para esta semana." tarefas={grupos.foco} ctx={ctx} destaque="foco" />
          <Seccao titulo="Em atraso" tarefas={atrasadas} ctx={ctx} destaque="urgente" />
          <Seccao titulo="Para hoje" tarefas={paraHoje} ctx={ctx} />
          <Seccao titulo="Com prazo" tarefas={grupos.proximas} ctx={ctx} />
          <Seccao
            titulo="Para ir fazendo"
            nota="Sem prazo — importantes, mas não urgentes. As que esperam há mais tempo aparecem primeiro."
            tarefas={grupos.paraIrFazendo}
            ctx={ctx}
          />
          {grupos.feitas.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted">
                Feitas nos últimos {DIAS_FEITAS_VISIVEIS} dias ({grupos.feitas.length})
              </summary>
              <ul className="mt-2 divide-y divide-border-subtle/60 rounded-xl border border-border-subtle bg-surface">
                {grupos.feitas.map((t) => (
                  <LinhaTarefa key={t.id} t={t} ctx={ctx} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Quadro */}
      {vista === 'quadro' && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              titulo: 'Por fazer',
              lista: [...grupos.foco, ...grupos.urgentes, ...grupos.proximas, ...grupos.paraIrFazendo].filter((t) => t.estado === 'por_fazer'),
            },
            {
              titulo: 'Em curso',
              lista: abertas.filter((t) => t.estado === 'em_curso'),
            },
            {
              titulo: `Feito (${DIAS_FEITAS_VISIVEIS} dias)`,
              lista: grupos.feitas,
            },
          ].map((coluna) => (
            <section key={coluna.titulo} className="rounded-xl border border-border-subtle bg-foreground/[.03] p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {coluna.titulo} ({coluna.lista.length})
              </h2>
              {coluna.lista.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Nada aqui.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {coluna.lista.map((t) => (
                    <CartaoQuadro key={t.id} t={t} ctx={ctx} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Calendário */}
      {vista === 'calendario' && (
        <CalendarioTarefas
          tarefas={visiveis}
          escala={escala}
          data={dataCalendario}
          comRotinas={sp.rotinas !== '0'}
          ctx={ctx}
          link={(extra) => link({ editar: undefined, ...extra })}
        />
      )}

      {/* Painel */}
      {vista === 'painel' && (
        <PainelTarefas
          est={estatisticasTarefas(
            semPessoa.filter((t) => t.estado !== 'feito'),
            feitasRecentes.filter(
              (f) =>
                (!sp.lista || (f.lista ?? '') === sp.lista) &&
                (estudioDaqui
                  ? f.estudio_id === null || f.estudio_id === estudioDaqui.id
                  : estudioFiltro === 'geral'
                    ? f.estudio_id === null
                    : estudioFiltro == null || f.estudio_id === estudioFiltro),
            ),
            hoje,
          )}
          ctx={ctx}
          linkPessoa={(id) => link({ vista: 'lista', pessoa: id ?? 'sem' })}
          linkLista={(lista) => link({ vista: 'lista', lista })}
        />
      )}

      {/* Por pessoa */}
      {vista === 'pessoas' && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...pessoas.map((p) => ({ id: p.id, nome: p.nome })), { id: 'sem', nome: 'Sem responsável' }].map((p) => {
            const dela = filtrarTarefas(semPessoa, { pessoa: p.id }).filter((t) => t.estado !== 'feito')
            if (dela.length === 0 && p.id === 'sem') return null
            const g = agruparTarefas(dela, hoje)
            const ordenadas = [...g.foco, ...g.urgentes, ...g.proximas, ...g.paraIrFazendo]
            return (
              <section key={p.id} className="rounded-xl border border-border-subtle bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={link({ vista: 'lista', pessoa: p.id })} className="text-base font-bold text-foreground hover:underline">
                    {p.nome}
                  </Link>
                  <span className="text-xs text-muted">
                    {dela.length} aberta{dela.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {g.urgentes.length > 0 && <span className="font-semibold text-red-700 dark:text-red-300">{g.urgentes.length} em atraso ou para hoje · </span>}
                  {g.foco.length} em foco · {g.paraIrFazendo.length} para ir fazendo
                </p>
                {ordenadas.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Sem tarefas abertas.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {ordenadas.slice(0, 8).map((t) => (
                      <li key={t.id} className="flex items-baseline gap-2 text-sm">
                        {emFoco(t, hoje) ? (
                          <Star className="h-3 w-3 shrink-0 translate-y-0.5 text-brand" fill="currentColor" />
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-border-strong" />
                        )}
                        <Link href={ctx.linkEditar(t.id)} className="min-w-0 flex-1 truncate text-foreground hover:underline">
                          {t.titulo}
                        </Link>
                        {t.prazo && (
                          <span className={`shrink-0 font-mono text-[11px] ${t.prazo <= hoje ? 'font-bold text-red-700 dark:text-red-300' : 'text-muted'}`}>
                            {dataCurta(t.prazo)}
                          </span>
                        )}
                      </li>
                    ))}
                    {ordenadas.length > 8 && <li className="text-xs text-muted">e mais {ordenadas.length - 8}…</li>}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
