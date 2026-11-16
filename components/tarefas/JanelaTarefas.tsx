'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { escolhaDeRepeticao, PRIORIDADES, type Tarefa } from '@/lib/data/tarefas'
import { detalheDaTarefa, eliminarTarefaNaJanela, guardarTarefaNaJanela, type DetalheNaJanela, type OperacaoNoDetalhe } from '@/app/painel/tarefasActions'
import CamposEstado from './CamposEstado'
import CamposRepeticao from './CamposRepeticao'

// A janela das tarefas: criar ou editar uma tarefa numa caixa pequena
// por cima da página, sem sair do sítio (como os eventos da Agenda).
// Abre com o botão direito do rato numa tarefa, ao clicar no título, ou
// no botão "Nova tarefa". Guardar não muda de página: a janela fecha-se
// e a lista por baixo atualiza-se.

const campoCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand'
const rotuloCls = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-muted'
const botaoSecCls = 'rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-brand/[.08] disabled:opacity-50'

export type DadosDaJanela = {
  // As tarefas que estão no ecrã (para abrir logo, sem ir buscar nada).
  tarefas: Tarefa[]
  pessoas: { id: string; nome: string }[]
  // Os estúdios que se podem escolher (dentro de um estúdio, só esse).
  estudios: { id: number; nome: string }[]
  listas: string[]
  // Numa conta pessoal, quem é (conclui e comenta em nome dela).
  euId: string | null
  ehAdmin: boolean
  ehGestao: boolean
  // O estúdio de uma tarefa nova, por omissão.
  estudioPadrao: number | null
  // Quantos passos tem cada tarefa (para o título da secção).
  passos: Record<string, { total: number; feitos: number }>
}

type Aberta = { modo: 'editar'; id: string } | { modo: 'nova'; prazo?: string } | null

const Contexto = createContext<{ abrir: (id: string) => void; nova: (prazo?: string) => void } | null>(null)

function useJanela() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('Falta o ProvedorTarefas à volta deste componente.')
  return ctx
}

export function ProvedorTarefas({ children, abrirInicial, ...dados }: DadosDaJanela & { children: React.ReactNode; abrirInicial?: string }) {
  const [aberta, setAberta] = useState<Aberta>(abrirInicial ? { modo: 'editar', id: abrirInicial } : null)
  const valor = useMemo(
    () => ({ abrir: (id: string) => setAberta({ modo: 'editar', id }), nova: (prazo?: string) => setAberta({ modo: 'nova', prazo }) }),
    []
  )
  const tarefa = aberta?.modo === 'editar' ? dados.tarefas.find((t) => t.id === aberta.id) : undefined
  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberta && (aberta.modo === 'nova' || tarefa) && (
        <Janela
          key={aberta.modo === 'editar' ? aberta.id : `nova-${aberta.prazo ?? ''}`}
          tarefa={tarefa}
          prazoInicial={aberta.modo === 'nova' ? aberta.prazo : undefined}
          dados={dados}
          onFechar={() => setAberta(null)}
        />
      )}
    </Contexto.Provider>
  )
}

// Envolve uma tarefa (linha da lista, cartão do calendário…): clicar
// nela com o botão direito do rato — ou tocar e manter, no telemóvel —
// abre a janela para a editar.
export function EditarComBotaoDireito({
  id,
  como: Elemento = 'li',
  className,
  title,
  children,
}: {
  id: string
  como?: 'li' | 'span' | 'div'
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const { abrir } = useJanela()
  return (
    <Elemento
      className={className}
      title={title}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        abrir(id)
      }}
    >
      {children}
    </Elemento>
  )
}

// O título de uma tarefa: clicar abre a janela.
export function AbrirTarefa({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { abrir } = useJanela()
  return (
    <button type="button" onClick={() => abrir(id)} className={`text-left ${className ?? ''}`}>
      {children}
    </button>
  )
}

// Botão para criar uma tarefa (com o prazo já posto, se vier de um dia
// do calendário).
export function BotaoNovaTarefa({ prazo, className, title, children }: { prazo?: string; className?: string; title?: string; children: React.ReactNode }) {
  const { nova } = useJanela()
  return (
    <button type="button" onClick={() => nova(prazo)} className={className} title={title} aria-label={title}>
      {children}
    </button>
  )
}

const quando = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Janela({ tarefa, prazoInicial, dados, onFechar }: { tarefa?: Tarefa; prazoInicial?: string; dados: DadosDaJanela; onFechar: () => void }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [aGuardar, iniciar] = useTransition()
  // Se os passos mudaram, a lista por baixo atualiza-se ao fechar.
  const mudou = useRef(false)

  function fechar() {
    if (mudou.current) router.refresh()
    onFechar()
  }

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mudou.current) router.refresh()
        onFechar()
      }
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onFechar, router])

  function submeter(e: React.FormEvent<HTMLFormElement>) {
    // Sem deixar o browser tratar do envio: assim, se houver um erro, o
    // que já foi escrito fica como está.
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await guardarTarefaNaJanela(formData)
      if (r.erro) setErro(r.erro)
      else onFechar()
    })
  }

  function eliminar() {
    if (!tarefa || !window.confirm(`Eliminar "${tarefa.titulo}" de vez? Se já está feita, basta concluí-la.`)) return
    setErro(null)
    iniciar(async () => {
      const r = await eliminarTarefaNaJanela(tarefa.id)
      if (r.erro) setErro(r.erro)
      else onFechar()
    })
  }

  const maisAberto = !!tarefa && (!!tarefa.responsavel_id || !!tarefa.inicio || !!tarefa.prioridade || tarefa.etiquetas.length > 0 || tarefa.reservada)
  const contagem = tarefa ? dados.passos[tarefa.id] : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tarefa ? 'Editar tarefa' : 'Nova tarefa'}
        className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-4 shadow-pop sm:max-h-[92vh] sm:overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}

        <form onSubmit={submeter} className="mt-3 flex flex-col gap-2.5">
          {tarefa && <input type="hidden" name="id" value={tarefa.id} />}
          <input name="titulo" required autoFocus={!tarefa} defaultValue={tarefa?.titulo ?? ''} placeholder="O que é para fazer?" className={`${campoCls} font-semibold`} />
          <div className="grid grid-cols-2 gap-2.5">
            <label className={rotuloCls}>
              Prazo
              <input type="date" name="prazo" defaultValue={tarefa?.prazo ?? prazoInicial ?? ''} className={campoCls} />
            </label>
            <label className={rotuloCls}>
              Hora
              <input type="time" name="hora" defaultValue={tarefa?.hora?.slice(0, 5) ?? ''} className={campoCls} />
            </label>
            <label className={rotuloCls}>
              Lista
              <input name="lista" list="listas-de-tarefas" defaultValue={tarefa?.lista ?? ''} placeholder="Ex.: Limpeza" className={campoCls} />
              <datalist id="listas-de-tarefas">
                {dados.listas.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
            <label className={rotuloCls}>
              Estúdio
              <select name="estudio_id" defaultValue={tarefa ? (tarefa.estudio_id ?? '') : (dados.estudioPadrao ?? '')} className={campoCls}>
                {dados.estudios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
                <option value="">Empresa toda</option>
              </select>
            </label>
          </div>
          <CamposRepeticao
            compacto
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
          <textarea name="descricao" rows={tarefa?.descricao ? 3 : 1} defaultValue={tarefa?.descricao ?? ''} placeholder="Detalhes (opcional)" className={campoCls} />

          <details open={maisAberto} className="rounded-lg border border-border-subtle">
            <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-muted">Mais opções — responsável, início, prioridade, etiquetas</summary>
            <div className="flex flex-col gap-2.5 border-t border-border-subtle p-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <label className={rotuloCls}>
                  Responsável
                  <select name="responsavel_id" defaultValue={tarefa?.responsavel_id ?? ''} className={campoCls}>
                    <option value="">Sem responsável</option>
                    {dados.pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={rotuloCls}>
                  Início
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
                  Etiquetas
                  <input name="etiquetas" defaultValue={tarefa?.etiquetas.join(', ') ?? ''} placeholder="separadas por vírgulas" className={campoCls} />
                </label>
              </div>
              {dados.ehAdmin && (
                <label className="flex items-center gap-2 text-xs font-medium text-muted">
                  <input type="checkbox" name="reservada" value="1" defaultChecked={tarefa?.reservada ?? false} className="h-4 w-4" />
                  Só a administração vê esta tarefa
                </label>
              )}
            </div>
          </details>

          {tarefa && (
            <CamposEstado
              compacto
              estadoInicial={tarefa.estado}
              feitaPorInicial={tarefa.feita_por ?? dados.euId ?? ''}
              pessoas={dados.pessoas}
              campoCls={campoCls}
              rotuloCls={rotuloCls}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" disabled={aGuardar} className="rounded-full bg-brand px-5 py-1.5 text-sm font-bold text-black hover:bg-brand-strong disabled:opacity-60">
              {aGuardar ? 'A guardar…' : tarefa ? 'Guardar' : 'Adicionar tarefa'}
            </button>
            <button type="button" onClick={fechar} className={botaoSecCls}>
              Cancelar
            </button>
            {tarefa && dados.ehGestao && (
              <button
                type="button"
                onClick={eliminar}
                disabled={aGuardar}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50 dark:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            )}
          </div>
        </form>

        {tarefa && <PassosEComentarios tarefa={tarefa} dados={dados} contagem={contagem} aoMudar={() => (mudou.current = true)} />}
      </div>
    </div>
  )
}

// Os passos e os comentários: fechados por omissão (a janela fica
// pequena) e só são lidos quando se abrem.
function PassosEComentarios({
  tarefa,
  dados,
  contagem,
  aoMudar,
}: {
  tarefa: Tarefa
  dados: DadosDaJanela
  contagem?: { total: number; feitos: number }
  aoMudar: () => void
}) {
  const [detalhe, setDetalhe] = useState<DetalheNaJanela | null>(null)
  const [ocupado, iniciar] = useTransition()
  const [autor, setAutor] = useState(dados.euId ?? '')

  function pedir(op: OperacaoNoDetalhe) {
    iniciar(async () => {
      const r = await detalheDaTarefa(tarefa.id, op)
      setDetalhe(r)
      if (op.tipo !== 'ler' && op.tipo !== 'comentar' && op.tipo !== 'apagar-comentario' && !r.erro) aoMudar()
    })
  }

  function juntarPasso(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const campo = e.currentTarget.elements.namedItem('passo') as HTMLInputElement
    if (!campo.value.trim()) return
    pedir({ tipo: 'juntar-passo', titulo: campo.value })
    campo.value = ''
  }

  function comentar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const campo = e.currentTarget.elements.namedItem('comentario') as HTMLTextAreaElement
    if (!campo.value.trim()) return
    pedir({ tipo: 'comentar', texto: campo.value, autorId: autor || null })
    campo.value = ''
  }

  const passos = detalhe?.passos ?? []
  const feitos = passos.filter((p) => p.feito).length
  const resumoPassos = detalhe ? (passos.length ? ` (${feitos}/${passos.length})` : '') : contagem ? ` (${contagem.feitos}/${contagem.total})` : ''

  return (
    <details
      className="mt-3 rounded-lg border border-border-subtle"
      onToggle={(e) => {
        if (e.currentTarget.open && !detalhe && !ocupado) pedir({ tipo: 'ler' })
      }}
    >
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-muted">
        Passos{resumoPassos} e comentários{detalhe && detalhe.comentarios.length ? ` (${detalhe.comentarios.length})` : ''}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border-subtle p-2.5">
        {!detalhe && <p className="text-xs text-muted">A carregar…</p>}
        {detalhe?.erro && <p className="rounded-md bg-red-500/15 px-2.5 py-1.5 text-xs text-red-700 dark:text-red-300">{detalhe.erro}</p>}
        {detalhe && (
          <>
            <section>
              {passos.length > 0 && (
                <ul className="mb-2 flex flex-col gap-0.5">
                  {passos.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-foreground/[.04]">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => pedir({ tipo: 'alternar-passo', passoId: p.id, feito: !p.feito })}
                        aria-label={p.feito ? `Desmarcar: ${p.titulo}` : `Marcar como feito: ${p.titulo}`}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          p.feito ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border-strong text-transparent hover:border-emerald-600 hover:text-emerald-600'
                        }`}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </button>
                      <span className={`min-w-0 flex-1 text-sm text-foreground ${p.feito ? 'line-through opacity-60' : ''}`}>{p.titulo}</span>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => pedir({ tipo: 'remover-passo', passoId: p.id })}
                        aria-label={`Remover o passo: ${p.titulo}`}
                        title="Remover"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={juntarPasso} className="flex gap-2">
                <input name="passo" placeholder="Acrescentar um passo…" className={campoCls} />
                <button type="submit" disabled={ocupado} className={`${botaoSecCls} shrink-0`}>
                  Juntar
                </button>
              </form>
            </section>

            <section className="border-t border-border-subtle pt-3">
              {detalhe.comentarios.length > 0 && (
                <ul className="mb-2 flex flex-col gap-1.5">
                  {detalhe.comentarios.map((c) => (
                    <li key={c.id} className="rounded-lg bg-foreground/[.04] px-2.5 py-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {c.autor_nome ?? dados.pessoas.find((p) => p.id === c.autor_id)?.nome ?? 'Conta do estúdio'}
                          <span className="ml-1.5 font-normal text-muted">{quando.format(new Date(c.criado_em))}</span>
                        </span>
                        {c.podeApagar && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => pedir({ tipo: 'apagar-comentario', comentarioId: c.id })}
                            className="text-[11px] font-semibold text-muted underline hover:text-foreground"
                          >
                            apagar
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.texto}</p>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={comentar} className="flex flex-col gap-2">
                <textarea name="comentario" rows={1} placeholder="Escrever um comentário…" className={campoCls} />
                <div className="flex items-center gap-2">
                  {!dados.euId && (
                    <select value={autor} onChange={(e) => setAutor(e.target.value)} required aria-label="Quem escreve" className={`${campoCls} max-w-48`}>
                      <option value="">Quem escreve…</option>
                      {dados.pessoas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="submit" disabled={ocupado} className={`${botaoSecCls} shrink-0`}>
                    Comentar
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </details>
  )
}

// Só para o botão "+" de um dia do calendário.
export function MaisNoDia({ data }: { data: string }) {
  return (
    <BotaoNovaTarefa
      prazo={data}
      title="Nova tarefa neste dia"
      className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-brand/[.15] hover:text-foreground"
    >
      <Plus className="h-3.5 w-3.5" />
    </BotaoNovaTarefa>
  )
}
