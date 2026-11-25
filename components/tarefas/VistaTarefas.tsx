import Link from '@/components/LinkRapido'
import { ArrowLeft, Play, Plus, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { getEstudios } from '@/lib/data/estudios'
import { hojeEmLisboa } from '@/lib/data/hoje'
import {
  agruparTarefas,
  carregarTarefas,
  carregarTarefasFeitas,
  DIAS_FEITAS_VISIVEIS,
  emFoco,
  estatisticasTarefas,
  filtrarTarefas,
  MAX_FOCO_POR_PESSOA,
  pessoasParaTarefas,
  type Tarefa,
} from '@/lib/data/tarefas'
import ConcluirTarefa from './ConcluirTarefa'
import { AbrirTarefa, BotaoNovaTarefa, EditarComBotaoDireito, ProvedorTarefas } from './JanelaTarefas'
import CalendarioTarefas, { ESCALAS, type Escala } from './CalendarioTarefas'
import PainelTarefas from './PainelTarefas'
import { botaoPequenoCls, CabecalhoLista, dataCurta, EstadoForm, LinhaTarefa, Pastilhas, type Contexto } from './partes'

// O ecrã das Tarefas — o mesmo em cada estúdio e na Coordenação (só
// muda o endereço de base e o tema). Dentro de um estúdio veem-se só as
// tarefas desse estúdio e as da empresa toda; na Coordenação, todas.
// Usa apenas as cores do tema e variantes "dark:", por isso lê-se bem
// nas áreas claras e na escura.

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
    <EditarComBotaoDireito id={t.id} className="rounded-lg border border-border-subtle bg-surface p-3">
      <AbrirTarefa id={t.id} className={`text-sm font-semibold text-foreground hover:underline ${t.estado === 'feito' ? 'line-through opacity-60' : ''}`}>
        {emFoco(t, ctx.hoje) && <Star className="mr-1 inline h-3.5 w-3.5 text-brand" fill="currentColor" />}
        {t.titulo}
      </AbrirTarefa>
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
  const [sessao, comPassos, pessoas, estudios, feitasRecentes] = await Promise.all([
    getSessaoAtual(),
    carregarTarefas(supabase, hoje),
    pessoasParaTarefas(),
    getEstudios(supabase),
    // Só o painel precisa do histórico das concluídas.
    verPainel ? carregarTarefasFeitas(supabase, hoje) : Promise.resolve([]),
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
  const abertas = visiveis.filter((t) => t.estado !== 'feito')
  const atrasadas = grupos.urgentes.filter((t) => t.prazo! < hoje)
  const paraHoje = grupos.urgentes.filter((t) => t.prazo === hoje)
  const vistas = VISTAS.filter((v) => v.id !== 'pessoas' || haResponsaveis || vista === 'pessoas')
  const estudiosDoFormulario = estudioDaqui ? [estudioDaqui] : estudios

  const chip = (ativo: boolean) => `barra-item ${ativo ? 'ativo' : ''}`

  return (
    <ProvedorTarefas
      tarefas={todas}
      pessoas={pessoas}
      estudios={estudiosDoFormulario.map((e) => ({ id: e.id, nome: e.nome }))}
      listas={listas}
      euId={euId}
      ehAdmin={ehAdmin}
      ehGestao={ehGestao}
      estudioPadrao={estudioDaqui?.id ?? (typeof estudioFiltro === 'number' ? estudioFiltro : null)}
      passos={Object.fromEntries(passos)}
      abrirInicial={sp.editar}
    >
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
              {estudioDaqui ? `As tarefas de ${estudioDaqui.nome} e as da empresa toda.` : 'As tarefas dos dois estúdios e as da empresa toda.'} Para concluir
              uma tarefa indica-se quem a fez. As que não têm prazo ficam em “Para ir fazendo”; a estrela põe uma tarefa no foco da semana (até{' '}
              {MAX_FOCO_POR_PESSOA} de cada vez).
            </p>
          </div>
        </div>

        {sp.error && <p className="mt-4 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{sp.error}</p>}
        {sp.ok && MENSAGENS_OK[sp.ok] && (
          <p className="mt-4 rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">{MENSAGENS_OK[sp.ok]}</p>
        )}

        {/* Vistas, filtros e "Nova tarefa" numa só barra: em cima como se
            quer ver, em baixo o que se quer ver. */}
        <div role="toolbar" aria-label="Vistas e filtros" className="barra em-linhas mt-5">
          <div className="barra-linha">
            {vistas.map((v) => (
              <Link
                key={v.id}
                href={link({ vista: v.id === VISTA_OMISSAO ? undefined : v.id, editar: undefined })}
                aria-current={v.id === vista ? 'page' : undefined}
                className="barra-item"
              >
                {v.rotulo}
              </Link>
            ))}
            <span aria-hidden className="min-w-0 flex-1" />
            {/* Nova tarefa — abre a janela pequena, tal como editar. */}
            <BotaoNovaTarefa className="barra-item barra-primario">
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Nova tarefa
            </BotaoNovaTarefa>
          </div>
          {vista !== 'pessoas' && vista !== 'painel' && (haResponsaveis || pessoa) && (
            <div className="barra-linha desliza">
              <span className="barra-etiqueta w-[4.5rem]">Quem</span>
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
            <div className="barra-linha desliza">
              <span className="barra-etiqueta w-[4.5rem]">Estúdio</span>
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
            <div className="barra-linha desliza">
              <span className="barra-etiqueta w-[4.5rem]">Lista</span>
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

        {/* Lista */}
        {vista === 'lista' && (
          <div className="mt-6 flex flex-col gap-6">
            {abertas.length === 0 && grupos.feitas.length === 0 && (
              <p className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
                Ainda não há tarefas
                {pessoa || sp.estudio || sp.lista ? ' com estes filtros' : ''}. Cria a primeira em “Nova tarefa”.
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
                    {g.urgentes.length > 0 && (
                      <span className="font-semibold text-red-700 dark:text-red-300">{g.urgentes.length} em atraso ou para hoje · </span>
                    )}
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
                          <AbrirTarefa id={t.id} className="min-w-0 flex-1 truncate text-foreground hover:underline">
                            {t.titulo}
                          </AbrirTarefa>
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
    </ProvedorTarefas>
  )
}
