'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Trash2, UserMinus, UserPlus, X } from 'lucide-react'
import { normalizarTexto } from '@/lib/texto'
import { cancelarAula, editarAula, inscreverNaAula, mudarInscricao, reabrirAula, removerInscricao, type ResultadoAula } from './actions'
import type { EstadoInscricao } from '@/lib/data/aulas'

export type InscritoNaJanela = {
  id: string
  clienteId: string
  nome: string
  estado: EstadoInscricao
  origem: 'equipa' | 'cliente'
  // Estado da pessoa neste serviço (Ativo, Pendente…), ou null se não
  // está inscrita no serviço.
  estadoServico: string | null
}

export type ClienteOpcaoAula = { id: string; nome: string; estadoServico: string | null }

export type AulaNaJanela = {
  id: string
  servicoNome: string
  data: string
  dataLabel: string
  horaInicio: string
  duracaoMin: number
  instrutorId: string | null
  lotacao: number
  estado: 'Aberta' | 'Cancelada'
  motivoCancelamento: string | null
}

const ESTILO_INSCRICAO: Record<EstadoInscricao, string> = {
  Inscrito: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  Presente: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  Faltou: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  Cancelada: 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800',
}

const campoCls = 'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand'

// A janela de uma aula: quem está inscrito (com presença), inscrever
// mais alguém (até à lotação), e mudar a aula (lotação, hora, instrutor,
// cancelar). Fica aberta depois de cada ação, para se fazerem várias.
export default function JanelaAula({
  estudioSlug,
  aula,
  inscritos,
  clientes,
  instrutores,
  podeEscrever,
  fecharHref,
}: {
  estudioSlug: string
  aula: AulaNaJanela
  inscritos: InscritoNaJanela[]
  clientes: ClienteOpcaoAula[]
  instrutores: { id: string; nome: string }[]
  podeEscrever: boolean
  fecharHref: string
}) {
  const router = useRouter()
  const [aGravar, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [editar, setEditar] = useState(false)

  const ativos = inscritos.filter((i) => i.estado !== 'Cancelada')
  const cheia = ativos.length >= aula.lotacao
  const jaInscritos = new Set(ativos.map((i) => i.clienteId))

  const sugestoes = useMemo(() => {
    const alvo = normalizarTexto(pesquisa)
    return clientes
      .filter((c) => !jaInscritos.has(c.id))
      .filter((c) => !alvo || alvo.split(/\s+/).every((p) => normalizarTexto(c.nome).includes(p)))
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, pesquisa, inscritos])

  function correr(acao: () => Promise<ResultadoAula>) {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if ('error' in r) setErro(r.error)
      else router.refresh()
    })
  }

  function fechar() {
    router.replace(fecharHref, { scroll: false })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aula"
        className="w-full max-w-xl rounded-2xl border border-border-subtle bg-surface p-4 shadow-pop sm:max-h-[92vh] sm:overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {aula.servicoNome} · {aula.horaInicio}
            </h2>
            <p className="text-xs text-muted">
              {aula.dataLabel} · {aula.duracaoMin} min · {instrutores.find((p) => p.id === aula.instrutorId)?.nome ?? 'sem instrutor'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                aula.estado === 'Cancelada'
                  ? 'bg-zinc-200 text-zinc-600'
                  : cheia
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              }`}
            >
              {aula.estado === 'Cancelada' ? 'Cancelada' : `${ativos.length}/${aula.lotacao}${cheia ? ' · cheia' : ''}`}
            </span>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {erro && <p className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}
        {aula.estado === 'Cancelada' && (
          <p className="mt-2 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            Aula cancelada{aula.motivoCancelamento ? ` — ${aula.motivoCancelamento}` : ''}.
          </p>
        )}

        <fieldset disabled={aGravar} className={`min-w-0 ${aGravar ? 'opacity-60' : ''}`}>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Inscritos</h3>
          {inscritos.length === 0 && <p className="mt-1 text-sm text-muted">Ainda ninguém se inscreveu.</p>}
          <ul className="mt-1 flex flex-col divide-y divide-border-subtle">
            {inscritos.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                <span className={`flex-1 font-medium ${i.estado === 'Cancelada' ? 'text-muted line-through' : 'text-foreground'}`}>
                  {i.nome}
                  {i.estadoServico && i.estadoServico !== 'Ativo' && (
                    <span className="ml-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">({i.estadoServico} no serviço)</span>
                  )}
                  {!i.estadoServico && <span className="ml-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">(sem inscrição no serviço)</span>}
                  {i.origem === 'cliente' && <span className="ml-1.5 text-[11px] text-muted">· pela app</span>}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILO_INSCRICAO[i.estado]}`}>{i.estado}</span>
                {podeEscrever && aula.estado === 'Aberta' && (
                  <span className="flex gap-1">
                    {i.estado !== 'Presente' && i.estado !== 'Cancelada' && (
                      <button
                        type="button"
                        title="Marcar presente"
                        onClick={() => correr(() => mudarInscricao({ estudioSlug, inscricaoId: i.id, estado: 'Presente' }))}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {i.estado !== 'Faltou' && i.estado !== 'Cancelada' && (
                      <button
                        type="button"
                        title="Marcar falta"
                        onClick={() => correr(() => mudarInscricao({ estudioSlug, inscricaoId: i.id, estado: 'Faltou' }))}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-red-600/40 text-xs font-bold text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        F
                      </button>
                    )}
                    {i.estado === 'Cancelada' ? (
                      <button
                        type="button"
                        title="Voltar a inscrever"
                        disabled={cheia}
                        onClick={() => correr(() => mudarInscricao({ estudioSlug, inscricaoId: i.id, estado: 'Inscrito' }))}
                        className="rounded-full border border-border-strong px-2 py-1 text-[11px] font-semibold hover:bg-brand/[.08] disabled:opacity-40"
                      >
                        Reinscrever
                      </button>
                    ) : (
                      <>
                        {i.estado !== 'Inscrito' && (
                          <button
                            type="button"
                            title="Desfazer (volta a Inscrito)"
                            onClick={() => correr(() => mudarInscricao({ estudioSlug, inscricaoId: i.id, estado: 'Inscrito' }))}
                            className="rounded-full border border-border-strong px-2 py-1 text-[11px] font-semibold hover:bg-brand/[.08]"
                          >
                            Desfazer
                          </button>
                        )}
                        <button
                          type="button"
                          title="Desistiu: cancelar a inscrição (liberta o lugar e fica no histórico como cancelada)"
                          onClick={() => correr(() => mudarInscricao({ estudioSlug, inscricaoId: i.id, estado: 'Cancelada' }))}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-red-600"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      title="Remover — inscrito por engano (apaga a inscrição, sem ficar no histórico)"
                      aria-label={`Remover ${i.nome} desta aula`}
                      onClick={() => {
                        if (window.confirm(`Remover ${i.nome} desta aula? A inscrição é apagada (para quando foi um engano).`)) {
                          correr(() => removerInscricao({ estudioSlug, inscricaoId: i.id }))
                        }
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>

          {podeEscrever && aula.estado === 'Aberta' && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Inscrever</h3>
              {cheia ? (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">A aula está cheia ({aula.lotacao} lugares).</p>
              ) : (
                <>
                  <input
                    value={pesquisa}
                    onChange={(e) => setPesquisa(e.target.value)}
                    placeholder="Procurar cliente…"
                    aria-label="Procurar cliente para inscrever"
                    className={`${campoCls} mt-1 w-full`}
                  />
                  <ul className="mt-1 flex flex-col">
                    {sugestoes.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPesquisa('')
                            correr(() => inscreverNaAula({ estudioSlug, aulaId: aula.id, clienteId: c.id }))
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-brand/[.08]"
                        >
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted" />
                          <span className="flex-1">{c.nome}</span>
                          <span className="text-[11px] text-muted">{c.estadoServico ? `${c.estadoServico} no serviço` : 'sem o serviço'}</span>
                        </button>
                      </li>
                    ))}
                    {sugestoes.length === 0 && <li className="px-2 py-1.5 text-sm text-muted">Nenhum cliente encontrado.</li>}
                  </ul>
                </>
              )}
            </div>
          )}

          {podeEscrever && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
              <button
                type="button"
                onClick={() => setEditar((v) => !v)}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold hover:bg-brand/[.08]"
              >
                {editar ? 'Fechar alterações' : 'Alterar esta aula'}
              </button>
              {aula.estado === 'Aberta' ? (
                <button
                  type="button"
                  onClick={() => {
                    const motivo = window.prompt(
                      ativos.length > 0
                        ? `Cancelar a aula? Há ${ativos.length} inscrito(s) — avisa-os. Motivo (opcional):`
                        : 'Cancelar a aula? Motivo (opcional):'
                    )
                    if (motivo !== null) correr(() => cancelarAula({ estudioSlug, aulaId: aula.id, motivo }))
                  }}
                  className="rounded-full border border-red-600/40 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Cancelar a aula
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => correr(() => reabrirAula({ estudioSlug, aulaId: aula.id }))}
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold hover:bg-brand/[.08]"
                >
                  Reabrir a aula
                </button>
              )}
            </div>
          )}

          {podeEscrever && editar && (
            <form
              className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                correr(() =>
                  editarAula({
                    estudioSlug,
                    aulaId: aula.id,
                    lotacao: Number(f.get('lotacao')),
                    instrutorId: (f.get('instrutor_id') as string) || null,
                    horaInicio: f.get('hora_inicio') as string,
                    duracaoMin: Number(f.get('duracao_min')) || aula.duracaoMin,
                  })
                )
              }}
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Hora
                <input name="hora_inicio" type="time" defaultValue={aula.horaInicio} className={campoCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Duração (min)
                <input name="duracao_min" type="number" min={10} max={240} defaultValue={aula.duracaoMin} className={campoCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Lotação
                <input name="lotacao" type="number" min={1} max={50} defaultValue={aula.lotacao} className={campoCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Instrutor
                <select name="instrutor_id" defaultValue={aula.instrutorId ?? ''} className={campoCls}>
                  <option value="">—</option>
                  {instrutores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="col-span-2 justify-self-start rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong sm:col-span-4"
              >
                Guardar esta aula
              </button>
            </form>
          )}
        </fieldset>
        {aGravar && <p className="mt-2 text-xs text-muted">A gravar…</p>}
      </div>
    </div>
  )
}
