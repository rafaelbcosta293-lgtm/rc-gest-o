'use client'

import { useRef, useState } from 'react'
import { BLOCOS, BLOCO_COR, CORREU } from '@/lib/data/constantes'
import type { BlocoTipo } from '@/lib/data/constantes'
import type { CatalogoExercicios, ItemCatalogo } from '@/lib/data/catalogo'
import ExercicioPicker from './ExercicioPicker'
// "[clienteId]" aqui é o nome literal da pasta (não um id concreto) — só
// existe um ficheiro actions.ts, partilhado por todos os clientes.
import { guardarLinhaExercicio, apagarLinhaExercicio } from './[clienteId]/treino/actions'
import SubmitButton from '@/components/SubmitButton'

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

const ROTULO_ESTADO: Record<EstadoLinha, string> = {
  'a guardar': 'a guardar…',
  guardado: 'guardado ✓',
  erro: 'não guardou — tenta outra vez',
}

export default function TreinoForm({
  estudioSlug,
  estudioId,
  clienteId,
  pts,
  inicial,
  catalogo: catalogoInicial,
  action,
  error,
}: {
  estudioSlug: string
  estudioId: number
  clienteId: string
  pts: { id: string; nome: string }[]
  inicial: TreinoInicial
  catalogo: CatalogoExercicios
  action: (formData: FormData) => void
  error?: string
}) {
  const sessaoId = inicial.id
  const [catalogo, setCatalogo] = useState(catalogoInicial)
  const [data, setData] = useState(inicial.data)
  const [pt, setPt] = useState(inicial.pt_id ?? pts[0]?.id ?? '')
  const [foco, setFoco] = useState(inicial.foco ?? '')
  const [correu, setCorreu] = useState(inicial.correu ?? 'Bem')
  const [tipoNota, setTipoNota] = useState(inicial.tipo_nota ?? 'Normal')
  const [notaProxima, setNotaProxima] = useState(inicial.nota_proxima ?? '')
  const [exercicios, setExercicios] = useState<LinhaExercicio[]>(
    inicial.exercicios.length ? inicial.exercicios : [linhaVazia()]
  )
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>({})
  const [seletorPara, setSeletorPara] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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
    const atualizada = { ...exercicios[indice], exercicio_id: item.id, exercicio_nome: item.nome }
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

  const inputCls =
    'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

  return (
    <div className="mt-6 flex flex-col gap-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Plano</h2>
          <span className="text-[11px] text-zinc-400">guarda-se sozinho, exercício a exercício</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {exercicios.map((linha, indice) => {
            const estado = estados[linha.key]
            return (
              <div
                key={linha.key}
                className="rounded-lg border border-black/10 p-3 dark:border-white/10"
              >
                <div className="flex items-center gap-2">
                  <select
                    value={linha.bloco}
                    onChange={(e) => aoMudarBloco(linha, indice, e.target.value as BlocoTipo)}
                    style={{ color: BLOCO_COR[linha.bloco] }}
                    className="w-[110px] shrink-0 rounded-md border border-black/10 px-2 py-1.5 text-xs font-semibold dark:border-white/10 dark:bg-zinc-900"
                  >
                    {BLOCOS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSeletorPara(linha.key)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-left text-sm ${
                      linha.exercicio_nome
                        ? 'border-black/10 dark:border-white/10'
                        : 'border-dashed border-black/20 text-zinc-500 dark:border-white/20'
                    }`}
                  >
                    {linha.exercicio_nome || 'Escolher exercício…'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removerLinha(linha)}
                    className="shrink-0 rounded-md px-2 text-lg text-zinc-400 hover:text-red-600"
                    aria-label="Remover linha"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={linha.series}
                    onChange={aoMudarCampo(linha, indice, 'series')}
                    placeholder="Séries"
                    className="w-20 min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                  />
                  <input
                    value={linha.reps}
                    onChange={aoMudarCampo(linha, indice, 'reps')}
                    placeholder="Reps"
                    className="w-20 min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                  />
                  <input
                    value={linha.carga}
                    onChange={aoMudarCampo(linha, indice, 'carga')}
                    placeholder="Carga"
                    className="w-20 min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                  />
                  <input
                    value={linha.descanso}
                    onChange={aoMudarCampo(linha, indice, 'descanso')}
                    placeholder="Descanso"
                    className="w-20 min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                  />
                  <input
                    value={linha.nota}
                    onChange={aoMudarCampo(linha, indice, 'nota')}
                    placeholder="Nota"
                    className="min-w-[120px] flex-[2] rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                  />
                </div>
                {estado && (
                  <p
                    className={`mt-1.5 text-[11px] ${estado === 'erro' ? 'text-red-600' : 'text-zinc-400'}`}
                  >
                    {ROTULO_ESTADO[estado]}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {BLOCOS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => adicionarLinha(b)}
              style={{ color: BLOCO_COR[b] }}
              className="rounded-md border border-dashed border-black/20 px-3 py-1.5 text-xs font-semibold dark:border-white/20"
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
        criado={aoCriarExercicio}
        escolher={(item) => {
          escolherExercicio(item)
          setSeletorPara(null)
        }}
      />

      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="estudio_slug" value={estudioSlug} />
        <input type="hidden" name="estudio_id" value={estudioId} />
        <input type="hidden" name="cliente_id" value={clienteId} />
        <input type="hidden" name="id" value={sessaoId} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Data</label>
            <input
              type="date"
              name="data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">PT</label>
            <select
              name="pt_id"
              value={pt}
              onChange={(e) => setPt(e.target.value)}
              className={inputCls}
            >
              {pts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Foco do treino
            </label>
            <input
              name="foco"
              value={foco}
              onChange={(e) => setFoco(e.target.value)}
              placeholder="ex.: Superior · empurrar"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Fecho do treino
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Como correu
              </label>
              <select
                name="correu"
                value={correu ?? 'Bem'}
                onChange={(e) => setCorreu(e.target.value)}
                className={inputCls}
              >
                {Object.keys(CORREU).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tipo de nota
              </label>
              <select
                name="tipo_nota"
                value={tipoNota ?? 'Normal'}
                onChange={(e) => setTipoNota(e.target.value)}
                className={inputCls}
              >
                {['Normal', 'Ajuste', 'Excelente', 'Lesão', 'Doença', 'Prova/Evento'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:bg-amber-950">
          <label className="block text-sm font-semibold text-amber-800 dark:text-amber-200">
            ⚑ Nota para o próximo treino
            <span className="font-normal">
              {' '}
              — é isto que o próximo PT vai ler antes de começar
            </span>
          </label>
          <textarea
            name="nota_proxima"
            rows={4}
            value={notaProxima}
            onChange={(e) => setNotaProxima(e.target.value)}
            placeholder="Veio doente e parou a meio · Recorde no agachamento, subir carga · Prova daqui a 3 semanas, aliviar volume…"
            className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900"
          />
        </div>

        <div className="flex justify-end gap-3">
          <SubmitButton
            pendingText="A guardar…"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Guardar treino
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
