'use client'

import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Ellipsis, Trash2 } from 'lucide-react'
import { BLOCOS, BLOCO_COR, CORREU, estiloDaNota, TIPOS_NOTA } from '@/lib/data/constantes'
import type { BlocoTipo } from '@/lib/data/constantes'
import type { CatalogoExercicios, ItemCatalogo } from '@/lib/data/catalogo'
import ExercicioPicker from './ExercicioPicker'
// "[clienteId]" aqui é o nome literal da pasta (não um id concreto) — só
// existe um ficheiro actions.ts, partilhado por todos os clientes.
import { guardarLinhaExercicio, apagarLinhaExercicio } from './[clienteId]/treino/actions'
import SubmitButton from '@/components/SubmitButton'
import FolhaInferior from '@/components/FolhaInferior'
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
  // Plano ligado a um treino da Agenda: a data é a desse treino.
  dataFixa?: boolean
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

// Computador e tablet (≥768px): uma linha por exercício, tudo lado a
// lado (bloco, exercício, séries, reps, carga, descanso, nota) — a
// legenda de cada coluna aparece uma só vez, no cabeçalho da grelha.
// Em ecrãs de toque as colunas e os campos são maiores (dedos, não
// rato). Telemóvel (<768px): cada exercício é um cartão, com os quatro
// números lado a lado e a legenda por cima de cada um — a grelha larga
// obrigava a deslizar de lado para chegar à carga e à nota.
// gap a 0 na grelha: o espaço entre colunas/linhas vem do padding de
// cada célula, para a risca de cada linha (border-b) ficar contínua.
const GRELHA_CLS =
  'flex flex-col gap-3 md:grid md:min-w-[756px] md:gap-0 ' +
  'md:grid-cols-[118px_minmax(160px,1.4fr)_56px_56px_64px_72px_minmax(120px,1fr)_64px] ' +
  'pointer-coarse:md:min-w-[748px] ' +
  'pointer-coarse:md:grid-cols-[126px_minmax(180px,2fr)_60px_68px_72px_80px_minmax(88px,1fr)_92px]'
const CABECALHOS_GRID = ['Bloco', 'Exercício', 'Séries', 'Reps', 'Carga', 'Descanso', 'Nota', '']

// Uma célula: no computador/tablet tem a risca horizontal (border-b) e
// o respiro entre colunas; no telemóvel é só uma peça do cartão (a
// posição dentro do cartão vem em `className`).
function CelulaGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center md:border-b md:border-border-subtle/70 md:px-1 md:py-1 ${className}`}>
      {children}
    </div>
  )
}

const campoPreenchidoCls =
  'w-full min-w-0 rounded-md bg-zinc-100 px-2 py-1.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand/50 dark:bg-zinc-800 dark:focus:bg-zinc-900 ' +
  'max-md:rounded-lg max-md:py-2.5 pointer-coarse:rounded-lg pointer-coarse:py-2.5 pointer-coarse:text-base'

// Campo de uma célula. No telemóvel leva a legenda por cima (no
// computador/tablet a legenda está no cabeçalho da grelha). Enter passa
// ao campo seguinte, para se preencher uma linha de seguida.
function CampoGrid({
  value,
  onChange,
  rotulo,
  teclado,
  className = '',
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  rotulo: string
  teclado?: 'numeric' | 'decimal'
  className?: string
}) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1">
      <span className="text-[10px] font-bold tracking-wide text-muted uppercase md:hidden">{rotulo}</span>
      <input
        value={value}
        onChange={onChange}
        aria-label={rotulo}
        data-campo-plano
        inputMode={teclado}
        enterKeyHint="next"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          const campos = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-campo-plano]'))
          campos[campos.indexOf(e.currentTarget) + 1]?.focus()
        }}
        className={`${campoPreenchidoCls} ${className}`}
      />
    </label>
  )
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
  // Sem autor escolhido fica vazio (obrigatório escolher) — nunca o
  // primeiro da lista por omissão, que ficava com planos que não fez.
  const [pt, setPt] = useState(inicial.pt_id ?? '')
  const [foco, setFoco] = useState(inicial.foco ?? '')
  const [correu, setCorreu] = useState(inicial.correu ?? '')
  const [tipoNota, setTipoNota] = useState(inicial.tipo_nota ?? 'Normal')
  const [notaProxima, setNotaProxima] = useState(inicial.nota_proxima ?? '')
  const [exercicios, setExercicios] = useState<LinhaExercicio[]>(
    inicial.exercicios.length ? inicial.exercicios : [linhaVazia()]
  )
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>({})
  const [seletorPara, setSeletorPara] = useState<string | null>(null)
  // Linha cujo menu (subir, descer, duplicar, remover) está aberto.
  const [menuPara, setMenuPara] = useState<string | null>(null)
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

  // A ordem de cada exercício é a posição na lista. Sempre que a
  // posição de várias linhas muda (remover, duplicar, mover), regravam-se
  // as afetadas — senão ficavam duas com a mesma ordem e, ao reabrir o
  // plano, podiam aparecer trocadas.
  const regravarOrdem = (linhas: LinhaExercicio[], desde: number, ate = linhas.length - 1) => {
    for (let k = Math.max(0, desde); k <= ate && k < linhas.length; k++) {
      clearTimeout(timers.current[linhas[k].key])
      void guardarLinha(linhas[k], k)
    }
  }

  const removerLinha = async (linha: LinhaExercicio) => {
    clearTimeout(timers.current[linha.key])
    const indice = exercicios.findIndex((l) => l.key === linha.key)
    const restantes = exercicios.filter((l) => l.key !== linha.key)
    setExercicios(restantes)
    if (linha.id) {
      const resultado = await apagarLinhaExercicio(linha.id)
      if ('error' in resultado) {
        // Não conseguiu apagar no servidor — repõe a linha em vez de
        // perder silenciosamente o exercício da vista.
        setExercicios((linhas) => [...linhas, linha])
        setEstados((s) => ({ ...s, [linha.key]: 'erro' }))
        return
      }
    }
    if (indice >= 0) regravarOrdem(restantes, indice)
  }

  // Acrescenta uma linha desse bloco e abre logo a escolha do exercício
  // (um toque a menos).
  const adicionarLinha = (bloco: BlocoTipo) => {
    const nova = linhaVazia(bloco)
    setExercicios((linhas) => [...linhas, nova])
    setSeletorPara(nova.key)
  }

  const moverLinha = (key: string, delta: -1 | 1) => {
    const i = exercicios.findIndex((l) => l.key === key)
    const j = i + delta
    if (i < 0 || j < 0 || j >= exercicios.length) return
    const nova = [...exercicios]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    setExercicios(nova)
    regravarOrdem(nova, Math.min(i, j), Math.max(i, j))
  }

  const duplicarLinha = (key: string) => {
    const i = exercicios.findIndex((l) => l.key === key)
    if (i < 0) return
    const copia = { ...exercicios[i], key: crypto.randomUUID(), id: null }
    const nova = [...exercicios.slice(0, i + 1), copia, ...exercicios.slice(i + 1)]
    setExercicios(nova)
    regravarOrdem(nova, i + 1)
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
    'rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand pointer-coarse:py-2.5 pointer-coarse:text-base'
  const labelCompactoCls = 'text-[11px] font-semibold uppercase tracking-wide text-muted'

  return (
    <div className="mt-6 flex flex-col gap-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">1 · Plano (antes do treino)</h2>
          <span className="text-[11px] text-zinc-400">guarda-se sozinho, exercício a exercício</span>
        </div>

        {/* Computador/tablet: uma grelha só, com o cabeçalho das colunas
            uma única vez (desliza de lado se a janela for estreita).
            Telemóvel: um cartão por exercício. Ver GRELHA_CLS. */}
        <div className="mt-2 md:overflow-x-auto md:overflow-y-hidden md:rounded-2xl md:border md:border-border-subtle md:bg-surface md:shadow-card">
          <div className={GRELHA_CLS}>
            {CABECALHOS_GRID.map((h, i) => (
              <span
                key={i}
                className="hidden border-b-2 border-border-strong bg-zinc-50 px-1 py-2 text-center text-[10px] font-bold tracking-wide text-muted uppercase md:block pointer-coarse:py-2.5 pointer-coarse:text-[11px] dark:bg-white/[.03]"
              >
                {h}
              </span>
            ))}

            {exercicios.map((linha, indice) => {
              const estado = estados[linha.key]
              return (
                <div
                  key={linha.key}
                  className="grid grid-cols-4 gap-x-2 gap-y-2.5 rounded-2xl border border-border-subtle bg-surface p-3 shadow-card md:contents"
                >
                  <CelulaGrid className="order-1 col-span-3 md:order-none md:col-span-1">
                    <select
                      value={linha.bloco}
                      onChange={(e) => aoMudarBloco(linha, indice, e.target.value as BlocoTipo)}
                      aria-label="Bloco"
                      style={{ color: BLOCO_COR[linha.bloco], boxShadow: `inset 3px 0 0 0 ${BLOCO_COR[linha.bloco]}` }}
                      className="w-full min-w-0 rounded-md bg-zinc-100 px-1.5 py-1.5 text-xs font-medium max-md:w-auto max-md:rounded-lg max-md:py-2 max-md:pr-8 max-md:pl-3 max-md:text-sm md:text-center pointer-coarse:rounded-lg pointer-coarse:py-2.5 pointer-coarse:text-sm dark:bg-zinc-800"
                    >
                      {BLOCOS.map((b) => (
                        <option key={b} value={b} style={{ color: BLOCO_COR[b] }}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </CelulaGrid>

                  <CelulaGrid className="order-3 col-span-4 md:order-none md:col-span-1">
                    <button
                      type="button"
                      onClick={() => setSeletorPara(linha.key)}
                      title={estado ? TITULO_ESTADO[estado] : undefined}
                      className={`relative w-full min-w-0 rounded-md px-2 py-1.5 text-left text-xs max-md:rounded-lg max-md:px-3 max-md:py-2.5 max-md:text-[15px] max-md:font-semibold pointer-coarse:rounded-lg pointer-coarse:py-2.5 pointer-coarse:text-[15px] ${
                        linha.exercicio_nome
                          ? 'bg-zinc-100 text-foreground dark:bg-zinc-800'
                          : 'bg-amber-50 text-amber-700 italic dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      <span className="block pr-3 md:truncate pointer-coarse:md:line-clamp-2 pointer-coarse:md:leading-tight pointer-coarse:md:whitespace-normal">
                        {linha.exercicio_nome || '+ Escolher exercício…'}
                      </span>
                      {/* Estado a guardar — um pontinho discreto no
                          canto, não uma linha de texto à parte por
                          exercício. */}
                      {estado && (
                        <span
                          title={TITULO_ESTADO[estado]}
                          className="absolute top-1/2 right-1.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full pointer-coarse:h-2 pointer-coarse:w-2"
                          style={{ background: COR_ESTADO[estado] }}
                        />
                      )}
                    </button>
                  </CelulaGrid>

                  <CelulaGrid className="order-4 md:order-none">
                    <CampoGrid rotulo="Séries" teclado="numeric" value={linha.series} onChange={aoMudarCampo(linha, indice, 'series')} className="text-center" />
                  </CelulaGrid>
                  <CelulaGrid className="order-4 md:order-none">
                    <CampoGrid rotulo="Reps" teclado="numeric" value={linha.reps} onChange={aoMudarCampo(linha, indice, 'reps')} className="text-center" />
                  </CelulaGrid>
                  <CelulaGrid className="order-4 md:order-none">
                    <CampoGrid rotulo="Carga" teclado="decimal" value={linha.carga} onChange={aoMudarCampo(linha, indice, 'carga')} className="text-center" />
                  </CelulaGrid>
                  <CelulaGrid className="order-4 md:order-none">
                    <CampoGrid rotulo="Descanso" teclado="numeric" value={linha.descanso} onChange={aoMudarCampo(linha, indice, 'descanso')} className="text-center" />
                  </CelulaGrid>
                  <CelulaGrid className="order-5 col-span-4 md:order-none md:col-span-1">
                    <CampoGrid rotulo="Nota" value={linha.nota} onChange={aoMudarCampo(linha, indice, 'nota')} />
                  </CelulaGrid>

                  <CelulaGrid className="order-2 col-span-1 justify-end gap-0.5 md:order-none md:justify-center">
                    <button
                      type="button"
                      onClick={() => setMenuPara(linha.key)}
                      aria-label="Mover ou duplicar este exercício"
                      title="Mover ou duplicar"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-foreground/[.06] hover:text-foreground max-md:h-10 max-md:w-10 pointer-coarse:h-10 pointer-coarse:w-10"
                    >
                      <Ellipsis className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removerLinha(linha)}
                      aria-label="Remover linha"
                      title="Remover"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 max-md:h-10 max-md:w-10 pointer-coarse:h-10 pointer-coarse:w-10 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5 pointer-coarse:h-[18px] pointer-coarse:w-[18px]" />
                    </button>
                  </CelulaGrid>
                </div>
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
              className="rounded-md border border-dashed border-border-strong px-3 py-1.5 text-xs font-semibold max-md:flex-1 max-md:rounded-xl max-md:py-2.5 max-md:text-sm pointer-coarse:rounded-xl pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm"
            >
              + {b}
            </button>
          ))}
        </div>
      </div>

      {/* Menu de uma linha: mover, duplicar, remover. */}
      {(() => {
        const i = exercicios.findIndex((l) => l.key === menuPara)
        const linha = i >= 0 ? exercicios[i] : null
        const opcaoCls =
          'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium active:bg-foreground/[.06] hover:bg-foreground/[.04] disabled:opacity-35'
        return (
          <FolhaInferior aberta={!!linha} aoFechar={() => setMenuPara(null)} titulo={linha?.exercicio_nome || 'Exercício'}>
            {linha && (
              <div className="flex flex-col">
                <button type="button" className={opcaoCls} disabled={i === 0} onClick={() => moverLinha(linha.key, -1)}>
                  <ArrowUp className="h-5 w-5 text-muted" /> Mover para cima
                </button>
                <button type="button" className={opcaoCls} disabled={i === exercicios.length - 1} onClick={() => moverLinha(linha.key, 1)}>
                  <ArrowDown className="h-5 w-5 text-muted" /> Mover para baixo
                </button>
                <button
                  type="button"
                  className={opcaoCls}
                  disabled={!linha.exercicio_nome}
                  onClick={() => {
                    duplicarLinha(linha.key)
                    setMenuPara(null)
                  }}
                >
                  <Copy className="h-5 w-5 text-muted" /> Duplicar
                </button>
                <button
                  type="button"
                  className={`${opcaoCls} text-red-700 dark:text-red-400`}
                  onClick={() => {
                    setMenuPara(null)
                    void removerLinha(linha)
                  }}
                >
                  <Trash2 className="h-5 w-5" /> Remover
                </button>
              </div>
            )}
          </FolhaInferior>
        )
      })()}

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

      {ok === 'treino' && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">Plano associado ao treino.</p>
      )}
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
            <input
              type="date"
              name="data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              readOnly={inicial.dataFixa}
              title={inicial.dataFixa ? 'É a data do treino marcado na Agenda — muda-se lá, ou associando o plano a outro treino' : undefined}
              className={`${inputCls} ${inicial.dataFixa ? 'cursor-not-allowed opacity-70' : ''}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCompactoCls}>Plano feito por</label>
            <select name="pt_id" value={pt} onChange={(e) => setPt(e.target.value)} required className={inputCls}>
              <option value="">— Escolher instrutor —</option>
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
            className="rounded-full border border-border-strong px-5 py-2 text-sm font-bold hover:bg-foreground/[.08] pointer-coarse:py-2.5"
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">2 · Depois do treino</h2>
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
                {TIPOS_NOTA.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={tipoNota === k}
                    onClick={() => {
                      setTipoNota(k)
                      marcarSujo()
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors pointer-coarse:px-4 pointer-coarse:py-2 pointer-coarse:text-sm ${
                      tipoNota === k ? estiloDaNota(k).botao : 'border-border-subtle text-muted hover:text-foreground'
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
                className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm pointer-coarse:text-base dark:bg-zinc-900"
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
