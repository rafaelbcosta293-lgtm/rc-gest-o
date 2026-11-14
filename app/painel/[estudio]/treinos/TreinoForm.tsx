'use client'

import { Fragment, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { BLOCOS, BLOCO_COR, CORREU } from '@/lib/data/constantes'
import type { BlocoTipo } from '@/lib/data/constantes'
import type { CatalogoExercicios, ItemCatalogo } from '@/lib/data/catalogo'
import ExercicioPicker from './ExercicioPicker'
// "[clienteId]" aqui é o nome literal da pasta (não um id concreto) — só
// existe um ficheiro actions.ts, partilhado por todos os clientes.
import { guardarLinhaExercicio, apagarLinhaExercicio } from './[clienteId]/treino/actions'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export type LinhaExercicio = {
  key: string
  id: string | null
  bloco: BlocoTipo
  exercicio_id: string | null
  exercicio_nome: string
  series: string
  reps: string
  carga: string
  descanso: string
  nota: string
}

function linhaVazia(bloco: BlocoTipo = 'Aquecimento'): LinhaExercicio {
  return {
    key: crypto.randomUUID(),
    id: null,
    bloco,
    exercicio_id: null,
    exercicio_nome: '',
    series: '',
    reps: '',
    carga: '',
    descanso: '',
    nota: '',
  }
}

export type TreinoInicial = {
  id: string
  data: string
  pt_id: string | null
  foco: string | null
  correu: string | null
  tipo_nota: string | null
  nota_proxima: string
  exercicios: LinhaExercicio[]
}

type EstadoLinha = 'a guardar' | 'guardado' | 'erro'

// Só um pontinho (ver GRID_COLUNAS/render) em vez de uma linha de texto
// por exercício — "guardado ✓" repetido exercício a exercício era mais
// ruído visual do que informação, numa página já cheia de linhas.
const COR_ESTADO: Record<EstadoLinha, string> = {
  'a guardar': '#A1A1AA',
  guardado: '#16A34A',
  erro: '#DC2626',
}
const TITULO_ESTADO: Record<EstadoLinha, string> = {
  'a guardar': 'A guardar…',
  guardado: 'Guardado',
  erro: 'Não guardou — tenta outra vez',
}

// Uma linha por exercício, tudo lado a lado (bloco, exercício, séries,
// reps, carga, descanso, nota) em vez de empilhado por baixo do nome —
// a legenda de cada coluna aparece uma só vez, no cabeçalho da grelha,
// em vez de repetida exercício a exercício. gap-x/gap-y ficam a 0: o
// espaço entre colunas/linhas vem do padding de cada CelulaGrid, não
// de um gap da grelha — assim a risca de cada linha (border-b) fica
// contínua de ponta a ponta, sem um "buraco" transparente a cortá-la.
const GRID_COLUNAS = '92px minmax(160px,1.4fr) 56px 56px 64px 72px minmax(120px,1fr) 28px'
const CABECALHOS_GRID = ['Bloco', 'Exercício', 'Séries', 'Reps', 'Carga', 'Descanso', 'Nota', '']

// Uma célula da grelha: só esta tem a risca horizontal (border-b) e o
// respiro entre colunas (padding) — o controlo lá dentro (select,
// input, botão) preenche-a toda, sem bordas próprias, só com um fundo
// preenchido (estilo Apple: caixa de texto cheia, não emoldurada).
function CelulaGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center border-b border-border-subtle/70 px-1 py-1 ${className}`}>
      {children}
    </div>
  )
}

const campoPreenchidoCls =
  'w-full min-w-0 rounded-md bg-zinc-100 px-2 py-1.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand/50 dark:bg-zinc-800 dark:focus:bg-zinc-900'

function CampoGrid({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  return <input value={value} onChange={onChange} className={`${campoPreenchidoCls} ${className}`} />
}

type ValoresSugeridos = { series: string; reps: string; carga: string; descanso: string }

export default function TreinoForm({
  estudioSlug,
  estudioId,
  clienteId,
  pts,
  inicial,
  catalogo: catalogoInicial,
  ultimosValores = {},
  maisUsados = [],
  hoje,
  acaoPlano,
  acaoRegisto,
  error,
  ok,
}: {
  estudioSlug: string
  estudioId: number
  clienteId: string
  pts: { id: string; nome: string }[]
  inicial: TreinoInicial
  catalogo: CatalogoExercicios
  ultimosValores?: Record<string, ValoresSugeridos>
  maisUsados?: ItemCatalogo[]
  hoje: string
  acaoPlano: (formData: FormData) => void
  acaoRegisto: (formData: FormData) => void
  error?: string
  ok?: string
}) {
  const sessaoId = inicial.id
  const [catalogo, setCatalogo] = useState(catalogoInicial)
  const [data, setData] = useState(inicial.data)
  const [pt, setPt] = useState(inicial.pt_id ?? pts[0]?.id ?? '')
  const [foco, setFoco] = useState(inicial.foco ?? '')
  const [correu, setCorreu] = useState(inicial.correu ?? '')
  const [tipoNota, setTipoNota] = useState(inicial.tipo_nota ?? 'Normal')
  const [notaProxima, setNotaProxima] = useState(inicial.nota_proxima ?? '')
  const [exercicios, setExercicios] = useState<LinhaExercicio[]>(
    inicial.exercicios.length ? inicial.exercicios : [linhaVazia()]
  )
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>({})
  const [seletorPara, setSeletorPara] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const { marcarSujo, limparSujo } = useAvisoSairSemGuardar()
  const registado = !!inicial.correu
  // O registo de como correu só abre no dia do treino (ou depois).
  const jaAconteceu = data <= hoje

  const guardarLinha = async (linha: LinhaExercicio, ordem: number) => {
    if (!linha.exercicio_nome.trim()) return
    setEstados((s) => ({ ...s, [linha.key]: 'a guardar' }))
    const resultado = await guardarLinhaExercicio({
      id: linha.id,
      sessaoId,
      ordem,
      bloco: linha.bloco,
      exercicio_id: linha.exercicio_id,
      exercicio_nome: linha.exercicio_nome,
      series: linha.series,
      reps: linha.reps,
      carga: linha.carga,
      descanso: linha.descanso,
      nota: linha.nota,
    })
    if ('error' in resultado) {
      setEstados((s) => ({ ...s, [linha.key]: 'erro' }))
      return
    }
    setExercicios((linhas) =>
      linhas.map((l) => (l.key === linha.key ? { ...l, id: resultado.id } : l))
    )
    setEstados((s) => ({ ...s, [linha.key]: 'guardado' }))
  }

  const agendarGuardar = (linha: LinhaExercicio, ordem: number) => {
    if (!linha.exercicio_nome.trim()) return
    clearTimeout(timers.current[linha.key])
    timers.current[linha.key] = setTimeout(() => guardarLinha(linha, ordem), 700)
  }

  // Séries/reps/carga/descanso/nota: guarda 700ms depois de parar de
  // escrever, para não disparar um pedido a cada letra.
  const aoMudarCampo =
    (linha: LinhaExercicio, indice: number, campo: keyof LinhaExercicio) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const atualizada = { ...linha, [campo]: e.target.value }
      setExercicios((linhas) => linhas.map((l) => (l.key === linha.key ? atualizada : l)))
      agendarGuardar(atualizada, indice)
    }

  // Bloco e exercício são escolhas discretas (não se escreve letra a
  // letra), por isso guardam de imediato em vez de esperar.
  const aoMudarBloco = (linha: LinhaExercicio, indice: number, bloco: BlocoTipo) => {
    const atualizada = { ...linha, bloco }
    setExercicios((linhas) => linhas.map((l) => (l.key === linha.key ? atualizada : l)))
    clearTimeout(timers.current[linha.key])
    guardarLinha(atualizada, indice)
  }

  const escolherExercicio = (item: ItemCatalogo) => {
    const indice = exercicios.findIndex((l) => l.key === seletorPara)
    if (indice === -1) return
    const linhaAtual = exercicios[indice]
    // Só sugere os valores da última vez se a linha ainda estiver em
    // branco — nunca substitui o que o PT já tenha escrito à mão.
    const semValoresAinda =
      !linhaAtual.series && !linhaAtual.reps && !linhaAtual.carga && !linhaAtual.descanso
    const sugestao = semValoresAinda ? ultimosValores[item.id] : undefined
    const atualizada = {
      ...linhaAtual,
      exercicio_id: item.id,
      exercicio_nome: item.nome,
      ...sugestao,
    }
    setExercicios((linhas) => linhas.map((l) => (l.key === atualizada.key ? atualizada : l)))
    clearTimeout(timers.current[atualizada.key])
    guardarLinha(atualizada, indice)
  }

  const removerLinha = async (linha: LinhaExercicio) => {
    clearTimeout(timers.current[linha.key])
    setExercicios((linhas) => linhas.filter((l) => l.key !== linha.key))
    if (linha.id) {
      const resultado = await apagarLinhaExercicio(linha.id)
      if ('error' in resultado) {
        // Não conseguiu apagar no servidor — repõe a linha em vez de
        // perder silenciosamente o exercício da vista.
        setExercicios((linhas) => [...linhas, linha])
        setEstados((s) => ({ ...s, [linha.key]: 'erro' }))
      }
    }
  }

  const adicionarLinha = (bloco: BlocoTipo) => {
    setExercicios((linhas) => [...linhas, linhaVazia(bloco)])
  }

  const aoCriarExercicio = (item: ItemCatalogo, categoriaId: string | null) => {
    setCatalogo((atual) => ({
      ...atual,
      todos: [...atual.todos, item].sort((a, b) => a.nome.localeCompare(b.nome)),
      porCategoria: categoriaId
        ? {
            ...atual.porCategoria,
            [categoriaId]: [...(atual.porCategoria[categoriaId] ?? []), item].sort((a, b) =>
              a.nome.localeCompare(b.nome)
            ),
          }
        : atual.porCategoria,
    }))
  }

  const aoEditarExercicio = (item: ItemCatalogo) => {
    setCatalogo((atual) => ({
      ...atual,
      todos: atual.todos
        .map((e) => (e.id === item.id ? item : e))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
      porCategoria: Object.fromEntries(
        Object.entries(atual.porCategoria).map(([catId, itens]) => [
          catId,
          itens
            .map((e) => (e.id === item.id ? item : e))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        ])
      ),
    }))
    setExercicios((linhas) =>
      linhas.map((l) => (l.exercicio_id === item.id ? { ...l, exercicio_nome: item.nome } : l))
    )
  }

  const aoEliminarExercicio = (id: string) => {
    setCatalogo((atual) => ({
      ...atual,
      todos: atual.todos.filter((e) => e.id !== id),
      porCategoria: Object.fromEntries(
        Object.entries(atual.porCategoria).map(([catId, itens]) => [
          catId,
          itens.filter((e) => e.id !== id),
        ])
      ),
    }))
  }

  const inputCls =
    'rounded-md border border-border-subtle px-2.5 py-1.5 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30'
  const labelCompactoCls = 'text-[11px] font-semibold uppercase tracking-wide text-zinc-500'

  return (
    <div className="mt-6 flex flex-col gap-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">1 · Plano (antes do treino)</h2>
          <span className="text-[11px] text-zinc-400">guarda-se sozinho, exercício a exercício</span>
        </div>

        {/* Uma grelha só, com o cabeçalho das colunas uma única vez —
            cada exercício ocupa uma linha (bloco, exercício, séries,
            reps, carga, descanso, nota lado a lado), em vez de um
            cartão alto por exercício com os campos empilhados por
            baixo do nome. overflow-x-auto + min-w garantem que as
            colunas nunca ficam espremidas num ecrã estreito — desliza
            em vez de encolher a ponto de ficar ilegível. */}
        <div className="mt-2 overflow-x-auto overflow-y-hidden rounded-2xl border border-border-subtle bg-surface shadow-card">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: GRID_COLUNAS }}>
            {CABECALHOS_GRID.map((h, i) => (
              <span
                key={i}
                className="border-b-2 border-border-strong bg-zinc-50 px-1 py-2 text-center text-[10px] font-bold tracking-wide text-zinc-500 uppercase dark:bg-white/[.03]"
              >
                {h}
              </span>
            ))}

            {exercicios.map((linha, indice) => {
              const estado = estados[linha.key]
              return (
                <Fragment key={linha.key}>
                  <CelulaGrid>
                    <select
                      value={linha.bloco}
                      onChange={(e) => aoMudarBloco(linha, indice, e.target.value as BlocoTipo)}
                      style={{ color: BLOCO_COR[linha.bloco], boxShadow: `inset 3px 0 0 0 ${BLOCO_COR[linha.bloco]}` }}
                      className="w-full min-w-0 rounded-md bg-zinc-100 px-1.5 py-1.5 text-center text-xs font-medium dark:bg-zinc-800"
                    >
                      {BLOCOS.map((b) => (
                        <option key={b} value={b} style={{ color: BLOCO_COR[b] }}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </CelulaGrid>

                  <CelulaGrid>
                    <button
                      type="button"
                      onClick={() => setSeletorPara(linha.key)}
                      title={estado ? TITULO_ESTADO[estado] : undefined}
                      className={`relative w-full min-w-0 rounded-md px-2 py-1.5 text-left text-xs ${
                        linha.exercicio_nome
                          ? 'bg-zinc-100 text-foreground dark:bg-zinc-800'
                          : 'bg-amber-50 text-amber-700 italic dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      <span className="block truncate pr-3">{linha.exercicio_nome || '+ Escolher exercício…'}</span>
                      {/* Estado a guardar — um pontinho discreto no
                          canto, não uma linha de texto à parte por
                          exercício. */}
                      {estado && (
                        <span
                          title={TITULO_ESTADO[estado]}
                          className="absolute top-1/2 right-1.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                          style={{ background: COR_ESTADO[estado] }}
                        />
                      )}
                    </button>
                  </CelulaGrid>

                  <CelulaGrid>
                    <CampoGrid
                      value={linha.series}
                      onChange={aoMudarCampo(linha, indice, 'series')}
                      className="text-center"
                    />
                  </CelulaGrid>
                  <CelulaGrid>
                    <CampoGrid value={linha.reps} onChange={aoMudarCampo(linha, indice, 'reps')} className="text-center" />
                  </CelulaGrid>
                  <CelulaGrid>
                    <CampoGrid
                      value={linha.carga}
                      onChange={aoMudarCampo(linha, indice, 'carga')}
                      className="text-center"
                    />
                  </CelulaGrid>
                  <CelulaGrid>
                    <CampoGrid
                      value={linha.descanso}
                      onChange={aoMudarCampo(linha, indice, 'descanso')}
                      className="text-center"
                    />
                  </CelulaGrid>
                  <CelulaGrid>
                    <CampoGrid value={linha.nota} onChange={aoMudarCampo(linha, indice, 'nota')} />
                  </CelulaGrid>

                  <CelulaGrid className="justify-center">
                    <button
                      type="button"
                      onClick={() => removerLinha(linha)}
                      aria-label="Remover linha"
                      className="flex items-center justify-center rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CelulaGrid>
                </Fragment>
              )
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {BLOCOS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => adicionarLinha(b)}
              style={{ color: BLOCO_COR[b] }}
              className="rounded-md border border-dashed border-border-strong px-3 py-1.5 text-xs font-semibold"
            >
              + {b}
            </button>
          ))}
        </div>
      </div>

      <ExercicioPicker
        aberto={seletorPara !== null}
        fechar={() => setSeletorPara(null)}
        catalogo={catalogo}
        maisUsados={maisUsados}
        criado={aoCriarExercicio}
        editado={aoEditarExercicio}
        eliminado={aoEliminarExercicio}
        escolher={(item) => {
          escolherExercicio(item)
          setSeletorPara(null)
        }}
      />

      {ok === 'plano' && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">Plano guardado.</p>
      )}

      <form action={acaoPlano} onChange={marcarSujo} onSubmit={limparSujo} className="flex flex-col gap-3">
        <input type="hidden" name="estudio_slug" value={estudioSlug} />
        <input type="hidden" name="estudio_id" value={estudioId} />
        <input type="hidden" name="cliente_id" value={clienteId} />
        <input type="hidden" name="id" value={sessaoId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_2fr_auto] sm:items-end">
          <div className="flex flex-col gap-1">
            <label className={labelCompactoCls}>Data do treino</label>
            <input type="date" name="data" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCompactoCls}>PT</label>
            <select name="pt_id" value={pt} onChange={(e) => setPt(e.target.value)} className={inputCls}>
              {pts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCompactoCls}>Foco do treino</label>
            <input
              name="foco"
              value={foco}
              onChange={(e) => setFoco(e.target.value)}
              placeholder="ex.: Superior · empurrar"
              className={inputCls}
            />
          </div>
          <SubmitButton
            pendingText="A guardar…"
            className="rounded-full border border-border-strong px-5 py-2 text-sm font-bold hover:bg-foreground/[.08]"
          >
            Guardar plano
          </SubmitButton>
        </div>
      </form>

      <section
        className={`rounded-2xl border-2 p-4 ${
          jaAconteceu ? 'border-brand/60 bg-surface' : 'border-dashed border-border-subtle bg-surface/60'
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">2 · Depois do treino</h2>
          {registado && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Treino registado</span>}
        </div>

        {!jaAconteceu ? (
          <p className="mt-2 text-sm text-muted">
            Disponível a partir do dia do treino. Até lá, prepara o plano acima — os exercícios ficam guardados sozinhos.
          </p>
        ) : (
          <form action={acaoRegisto} onChange={marcarSujo} onSubmit={limparSujo} className="mt-3 flex flex-col gap-4">
            <input type="hidden" name="estudio_slug" value={estudioSlug} />
            <input type="hidden" name="cliente_id" value={clienteId} />
            <input type="hidden" name="id" value={sessaoId} />
            <input type="hidden" name="correu" value={correu} />
            <input type="hidden" name="tipo_nota" value={tipoNota} />

            <div>
              <p className={labelCompactoCls}>Como correu?</p>
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Como correu">
                {(Object.keys(CORREU) as (keyof typeof CORREU)[]).map((k) => {
                  const ativo = correu === k
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => {
                        setCorreu(k)
                        marcarSujo()
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                        ativo ? 'border-transparent' : 'border-border-subtle text-muted hover:text-foreground'
                      }`}
                      style={ativo ? { background: CORREU[k].bg, color: CORREU[k].tx } : undefined}
                    >
                      {k}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className={labelCompactoCls}>Tipo de nota</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de nota">
                {['Normal', 'Ajuste', 'Excelente', 'Lesão', 'Doença', 'Prova/Evento'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={tipoNota === k}
                    onClick={() => {
                      setTipoNota(k)
                      marcarSujo()
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      tipoNota === k
                        ? 'border-brand bg-brand/15 text-foreground'
                        : 'border-border-subtle text-muted hover:text-foreground'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:bg-amber-950">
              <label className="block text-sm font-semibold text-amber-800 dark:text-amber-200">
                ⚑ Nota para o próximo treino
                <span className="font-normal"> — é isto que o próximo PT vai ler antes de começar</span>
              </label>
              <textarea
                name="nota_proxima"
                rows={3}
                value={notaProxima}
                onChange={(e) => setNotaProxima(e.target.value)}
                className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {!correu && <span className="text-xs text-muted">Escolhe como correu para concluir.</span>}
              <SubmitButton
                pendingText="A registar…"
                disabled={!correu}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
              >
                {registado ? 'Atualizar registo' : 'Concluir treino'}
              </SubmitButton>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
