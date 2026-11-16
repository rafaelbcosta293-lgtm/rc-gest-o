import Link from '@/components/LinkRapido'
import { ArrowLeft, Check, Lock, Play, Repeat, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { getEstudios } from '@/lib/data/estudios'
import { hojeEmLisboa } from '@/lib/data/hoje'
import {
  agruparTarefas,
  carregarTarefas,
  descricaoRepeticao,
  DIAS_DA_SEMANA,
  DIAS_FEITAS_VISIVEIS,
  DIAS_TAREFA_PARADA,
  emFoco,
  escolhaDeRepeticao,
  ESTADOS_TAREFA,
  filtrarTarefas,
  haQuantoTempo,
  idadeEmDias,
  MAX_FOCO_POR_PESSOA,
  pessoasParaTarefas,
  REPETICOES_TAREFA,
  type Tarefa,
} from '@/lib/data/tarefas'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { alternarFocoTarefa, atualizarTarefa, criarTarefa, eliminarTarefa, mudarEstadoTarefa } from '@/app/painel/tarefasActions'

// O ecrã das Tarefas — o mesmo em cada estúdio, na Coordenação e na
// Administração (só muda o endereço de base e o tema). Usa apenas as
// cores do tema e variantes "dark:", por isso lê-se bem nas áreas
// claras e na escura.

export type ParametrosTarefas = {
  vista?: string
  pessoa?: string
  estudio?: string
  lista?: string
  editar?: string
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

const VISTAS = [
  { id: 'lista', rotulo: 'Lista' },
  { id: 'quadro', rotulo: 'Quadro' },
  { id: 'pessoas', rotulo: 'Por pessoa' },
]

const campoCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-brand'
const rotuloCls = 'flex flex-col gap-1 text-xs font-medium text-muted'
const pastilhaCls = 'inline-flex items-center gap-1 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-muted'
const botaoPequenoCls =
  'rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-brand/[.08]'

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

type Contexto = {
  hoje: string
  voltar: string
  nomePessoa: Map<string, string>
  nomeEstudio: Map<number, string>
  linkEditar: (id: string) => string
}

function EstadoForm({ id, estado, voltar, children, className }: { id: string; estado: string; voltar: string; children: React.ReactNode; className?: string }) {
  return (
    <form action={mudarEstadoTarefa} className={className}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <input type="hidden" name="voltar" value={voltar} />
      {children}
    </form>
  )
}

function Pastilhas({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  const atrasada = t.estado !== 'feito' && !!t.prazo && t.prazo < ctx.hoje
  const paraHoje = t.estado !== 'feito' && t.prazo === ctx.hoje
  const idade = idadeEmDias(t.criado_em, ctx.hoje)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {t.prazo && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
            atrasada
              ? 'bg-red-500/15 text-red-700 dark:text-red-300'
              : paraHoje
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                : 'bg-foreground/[.06] text-muted'
          }`}
        >
          {atrasada ? 'Atrasada · ' : paraHoje ? 'Hoje · ' : ''}
          {dataCurta(t.prazo)}
        </span>
      )}
      {!t.prazo && t.estado !== 'feito' && (
        // Parada há muito tempo: fica assinalada a âmbar.
        <span
          className={
            idade > DIAS_TAREFA_PARADA
              ? 'inline-flex items-center rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200'
              : pastilhaCls
          }
        >
          criada {haQuantoTempo(idade)}
        </span>
      )}
      {t.estado === 'em_curso' && (
        <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">Em curso</span>
      )}
      {descricaoRepeticao(t) && (
        <span className={pastilhaCls} title="Ao concluir, volta a aparecer no dia seguinte em que se faz">
          <Repeat className="h-3 w-3" /> {descricaoRepeticao(t)}
        </span>
      )}
      <span className={pastilhaCls}>{t.responsavel_id ? (ctx.nomePessoa.get(t.responsavel_id) ?? 'Sem responsável') : 'Sem responsável'}</span>
      {t.lista && <span className={pastilhaCls}>{t.lista}</span>}
      {t.estudio_id != null && ctx.nomeEstudio.get(t.estudio_id) && <span className={pastilhaCls}>{ctx.nomeEstudio.get(t.estudio_id)}</span>}
      {t.reservada && (
        <span className={pastilhaCls} title="Só a administração vê esta tarefa">
          <Lock className="h-3 w-3" /> Só administração
        </span>
      )}
    </div>
  )
}

function LinhaTarefa({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  const feita = t.estado === 'feito'
  const foco = emFoco(t, ctx.hoje)
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <EstadoForm id={t.id} estado={feita ? 'por_fazer' : 'feito'} voltar={ctx.voltar} className="mt-0.5 shrink-0">
        <button
          type="submit"
          title={feita ? 'Voltar a abrir' : 'Concluir'}
          aria-label={feita ? `Voltar a abrir: ${t.titulo}` : `Concluir: ${t.titulo}`}
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
            feita ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border-strong text-transparent hover:border-emerald-600 hover:text-emerald-600'
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      </EstadoForm>
      <div className="min-w-0 flex-1">
        <Link href={ctx.linkEditar(t.id)} className={`text-sm font-semibold text-foreground hover:underline ${feita ? 'line-through opacity-60' : ''}`}>
          {t.titulo}
        </Link>
        {t.descricao && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted">{t.descricao}</p>}
        <Pastilhas t={t} ctx={ctx} />
      </div>
      {!feita && (
        <div className="flex shrink-0 items-center gap-1.5">
          <EstadoForm id={t.id} estado={t.estado === 'em_curso' ? 'por_fazer' : 'em_curso'} voltar={ctx.voltar}>
            <button type="submit" className={botaoPequenoCls} title={t.estado === 'em_curso' ? 'Voltar a "por fazer"' : 'Marcar como em curso'}>
              {t.estado === 'em_curso' ? 'Parar' : 'Começar'}
            </button>
          </EstadoForm>
          <form action={alternarFocoTarefa}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="voltar" value={ctx.voltar} />
            <button
              type="submit"
              title={foco ? 'Tirar do foco da semana' : 'Pôr no foco desta semana'}
              aria-label={foco ? `Tirar do foco: ${t.titulo}` : `Pôr no foco da semana: ${t.titulo}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                foco ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted hover:border-brand hover:text-foreground'
              }`}
            >
              <Star className="h-3.5 w-3.5" fill={foco ? 'currentColor' : 'none'} />
            </button>
          </form>
        </div>
      )}
    </li>
  )
}

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
        <ul
          className={`mt-2 divide-y divide-border-subtle/60 rounded-xl border bg-surface ${
            destaque === 'foco' ? 'border-brand' : 'border-border-subtle'
          }`}
        >
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
    <li className="rounded-lg border border-border-subtle bg-surface p-3">
      <Link href={ctx.linkEditar(t.id)} className={`text-sm font-semibold text-foreground hover:underline ${t.estado === 'feito' ? 'line-through opacity-60' : ''}`}>
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
        {t.estado !== 'feito' ? (
          <EstadoForm id={t.id} estado="feito" voltar={ctx.voltar}>
            <button type="submit" className={botaoPequenoCls}>
              <Check className="mr-1 inline h-3 w-3" strokeWidth={3} />
              Concluir
            </button>
          </EstadoForm>
        ) : (
          <EstadoForm id={t.id} estado="por_fazer" voltar={ctx.voltar}>
            <button type="submit" className={botaoPequenoCls}>
              Reabrir
            </button>
          </EstadoForm>
        )}
      </div>
    </li>
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
  estudios: { id: number; nome: string }[]
  listas: string[]
  podeReservar: boolean
  padrao?: { responsavelId?: string; estudioId?: number }
}) {
  return (
    <>
      <input
        name="titulo"
        required
        defaultValue={tarefa?.titulo ?? ''}
        placeholder="O que é para fazer? Ex.: Atualizar o preçário, ligar ao fornecedor das máquinas"
        className={campoCls}
      />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <label className={rotuloCls}>
          Responsável
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
          Prazo (opcional)
          <input type="date" name="prazo" defaultValue={tarefa?.prazo ?? ''} className={campoCls} />
        </label>
        <label className={rotuloCls}>
          Lista (opcional)
          <input name="lista" list="listas-de-tarefas" defaultValue={tarefa?.lista ?? ''} placeholder="Ex.: Marketing, Manutenção" className={campoCls} />
          <datalist id="listas-de-tarefas">
            {listas.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
        <label className={rotuloCls}>
          Estúdio
          <select name="estudio_id" defaultValue={tarefa ? (tarefa.estudio_id ?? '') : (padrao?.estudioId ?? '')} className={campoCls}>
            <option value="">Empresa toda</option>
            {estudios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className={rotuloCls}>
          Repetir
          <select name="repeticao" defaultValue={tarefa ? escolhaDeRepeticao(tarefa) : 'nao'} className={campoCls}>
            {REPETICOES_TAREFA.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted">
          <legend className="mb-1">Dias (só para “dias da semana escolhidos”)</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 py-1.5">
            {DIAS_DA_SEMANA.map((d) => (
              <label key={d.valor} className="flex items-center gap-1.5 text-sm text-foreground">
                <input type="checkbox" name="dia" value={d.valor} defaultChecked={tarefa?.repete_dias?.includes(d.valor) ?? false} className="h-4 w-4" />
                {d.curto}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="-mt-1 text-xs text-muted">Uma tarefa que se repete volta a aparecer, com o prazo seguinte, quando é concluída.</p>
      <textarea name="descricao" rows={tarefa?.descricao ? 4 : 2} defaultValue={tarefa?.descricao ?? ''} placeholder="Detalhes (opcional)" className={campoCls} />
      {podeReservar && (
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          <input type="checkbox" name="reservada" value="1" defaultChecked={tarefa?.reservada ?? false} className="h-4 w-4" />
          Só a administração vê esta tarefa (salários, avaliações, assuntos de gestão)
        </label>
      )}
    </>
  )
}

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
  const [sessao, todas, pessoas, estudios] = await Promise.all([
    getSessaoAtual(),
    carregarTarefas(supabase, hoje),
    pessoasParaTarefas(),
    getEstudios(supabase),
  ])
  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)

  // Numa conta pessoal abre-se nas tarefas da própria pessoa; nas contas
  // partilhadas (estúdios, Coordenação) e na do dono, em todas.
  const contaPessoal = !!sessao.userId && !ehContaFixa(sessao.email) && pessoas.some((p) => p.id === sessao.userId)
  const pessoa = sp.pessoa === 'todas' ? undefined : (sp.pessoa ?? (contaPessoal ? sessao.userId! : undefined))
  const vista = VISTAS.some((v) => v.id === sp.vista) ? sp.vista! : 'lista'
  const estudioFiltro = sp.estudio === 'geral' ? ('geral' as const) : estudios.find((e) => e.slug === sp.estudio)?.id
  const listas = [...new Set(todas.map((t) => t.lista).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b, 'pt'))

  const link = (extra: Partial<ParametrosTarefas> = {}) => {
    const valores: Partial<ParametrosTarefas> = { vista: vista === 'lista' ? undefined : vista, pessoa: sp.pessoa, estudio: sp.estudio, lista: sp.lista, ...extra }
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
  }

  // "Por pessoa" mostra sempre a equipa toda; as outras vistas respeitam
  // o filtro de pessoa.
  const semPessoa = filtrarTarefas(todas, { estudioId: estudioFiltro, lista: sp.lista })
  const visiveis = filtrarTarefas(semPessoa, { pessoa })
  const grupos = agruparTarefas(visiveis, hoje)
  const emEdicao = sp.editar ? todas.find((t) => t.id === sp.editar) : undefined
  const abertas = visiveis.filter((t) => t.estado !== 'feito')

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
            O que há para fazer na empresa, quem trata e até quando. As tarefas sem prazo ficam em “Para ir fazendo”; a estrela põe uma tarefa no
            foco da semana (até {MAX_FOCO_POR_PESSOA} por pessoa).
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1">
          {VISTAS.map((v) => (
            <Link
              key={v.id}
              href={link({ vista: v.id === 'lista' ? undefined : v.id, editar: undefined })}
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
        {vista !== 'pessoas' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 text-xs font-semibold uppercase tracking-wider text-muted">Quem</span>
            <Link href={link({ pessoa: contaPessoal ? 'todas' : undefined, editar: undefined })} className={chip(!pessoa)}>
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
        {listas.length > 0 && (
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
        <section id="editar" className="mt-5 scroll-mt-24 rounded-xl border border-brand bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">Editar tarefa</h2>
            <Link href={link({ editar: undefined })} className="text-xs font-semibold text-muted underline hover:text-foreground">
              Fechar
            </Link>
          </div>
          <form action={atualizarTarefa} className="mt-3 flex flex-col gap-2.5">
            <input type="hidden" name="id" value={emEdicao.id} />
            <input type="hidden" name="voltar" value={voltar} />
            <CamposTarefa tarefa={emEdicao} pessoas={pessoas} estudios={estudios} listas={listas} podeReservar={ehAdmin} />
            <label className={`${rotuloCls} max-w-56`}>
              Estado
              <select name="estado" defaultValue={emEdicao.estado} className={campoCls}>
                {ESTADOS_TAREFA.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton pendingText="A guardar…" className="self-start rounded-full bg-brand px-5 py-2 text-sm font-bold text-black hover:bg-brand-strong">
              Guardar
            </SubmitButton>
          </form>
          {ehGestao && (
            <ConfirmarAcao action={eliminarTarefa} confirmacao={`Eliminar "${emEdicao.titulo}" de vez? Se já está feita, basta concluí-la.`} className="mt-3">
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
              estudios={estudios}
              listas={listas}
              podeReservar={ehAdmin}
              padrao={{
                responsavelId: pessoa && pessoa !== 'sem' ? pessoa : undefined,
                estudioId: typeof estudioFiltro === 'number' ? estudioFiltro : estudios.find((e) => e.slug === estudioSlug)?.id,
              }}
            />
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
              Ainda não há tarefas{pessoa || sp.estudio || sp.lista ? ' com estes filtros' : ''}. Cria a primeira em cima.
            </p>
          )}
          <Seccao titulo="Foco desta semana" nota="As tarefas escolhidas para esta semana." tarefas={grupos.foco} ctx={ctx} destaque="foco" />
          <Seccao titulo="Em atraso e para hoje" tarefas={grupos.urgentes} ctx={ctx} destaque="urgente" />
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
            { titulo: 'Por fazer', lista: [...grupos.foco, ...grupos.urgentes, ...grupos.proximas, ...grupos.paraIrFazendo].filter((t) => t.estado === 'por_fazer') },
            { titulo: 'Em curso', lista: abertas.filter((t) => t.estado === 'em_curso') },
            { titulo: `Feito (${DIAS_FEITAS_VISIVEIS} dias)`, lista: grupos.feitas },
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
                  <Link href={link({ vista: undefined, pessoa: p.id })} className="text-base font-bold text-foreground hover:underline">
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
                        {emFoco(t, hoje) ? <Star className="h-3 w-3 shrink-0 translate-y-0.5 text-brand" fill="currentColor" /> : <span className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-border-strong" />}
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
