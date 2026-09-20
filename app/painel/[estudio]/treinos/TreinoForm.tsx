'use client'

import { useState } from 'react'
import { BLOCOS, BLOCO_COR, CORREU } from '@/lib/data/constantes'
import type { ExercicioSessao, Sessao } from '@/lib/supabase/database.types'
import ExercicioPicker from './ExercicioPicker'

function linhaVazia(bloco: ExercicioSessao['bloco'] = 'Aquecimento'): ExercicioSessao {
  return {
    id: crypto.randomUUID(),
    bloco,
    nome: '',
    series: '',
    reps: '',
    carga: '',
    descanso: '',
    nota: '',
  }
}

export default function TreinoForm({
  estudio,
  clienteId,
  pts,
  ptPredefinido,
  sessao,
  action,
  error,
}: {
  estudio: string
  clienteId: string
  pts: { id: string; nome: string }[]
  ptPredefinido?: string
  sessao?: Sessao
  action: (formData: FormData) => void
  error?: string
}) {
  const [data, setData] = useState(sessao?.data ?? new Date().toISOString().slice(0, 10))
  const [pt, setPt] = useState(sessao?.pt ?? ptPredefinido ?? pts[0]?.id ?? '')
  const [foco, setFoco] = useState(sessao?.foco ?? '')
  const [correu, setCorreu] = useState(sessao?.correu ?? 'Bem')
  const [tipoNota, setTipoNota] = useState(sessao?.tipo_nota ?? 'Normal')
  const [notaProxima, setNotaProxima] = useState(sessao?.nota_proxima ?? '')
  const [exercicios, setExercicios] = useState<ExercicioSessao[]>(
    sessao?.exercicios?.length ? sessao.exercicios : [linhaVazia()]
  )
  const [seletorPara, setSeletorPara] = useState<string | null>(null)

  const atualizarLinha = (id: string, campo: keyof ExercicioSessao, valor: string) => {
    setExercicios((linhas) => linhas.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
  }
  const removerLinha = (id: string) => {
    setExercicios((linhas) => linhas.filter((l) => l.id !== id))
  }
  const adicionarLinha = (bloco: ExercicioSessao['bloco']) => {
    setExercicios((linhas) => [...linhas, linhaVazia(bloco)])
  }

  const podeGuardar = notaProxima.trim().length > 0
  const inputCls =
    'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

  return (
    <form action={action} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="estudio" value={estudio} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      {sessao && <input type="hidden" name="id" value={sessao.id} />}
      <input type="hidden" name="exercicios" value={JSON.stringify(exercicios)} readOnly />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

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
          <select name="pt" value={pt} onChange={(e) => setPt(e.target.value)} className={inputCls}>
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Plano</h2>
        <div className="mt-2 flex flex-col gap-2">
          {exercicios.map((linha) => (
            <div
              key={linha.id}
              className="grid grid-cols-2 gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-[110px_1fr_auto] dark:border-white/10"
            >
              <select
                value={linha.bloco}
                onChange={(e) =>
                  atualizarLinha(linha.id, 'bloco', e.target.value as ExercicioSessao['bloco'])
                }
                style={{ color: BLOCO_COR[linha.bloco] }}
                className="rounded-md border border-black/10 px-2 py-1.5 text-xs font-semibold dark:border-white/10 dark:bg-zinc-900"
              >
                {BLOCOS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSeletorPara(linha.id)}
                className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                  linha.nome
                    ? 'border-black/10 dark:border-white/10'
                    : 'border-dashed border-black/20 text-zinc-500 dark:border-white/20'
                }`}
              >
                {linha.nome || 'Escolher exercício…'}
              </button>
              <button
                type="button"
                onClick={() => removerLinha(linha.id)}
                className="justify-self-end rounded-md px-2 text-lg text-zinc-400 hover:text-red-600"
                aria-label="Remover linha"
              >
                ×
              </button>
              <input
                value={linha.series}
                onChange={(e) => atualizarLinha(linha.id, 'series', e.target.value)}
                placeholder="Séries"
                className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                value={linha.reps}
                onChange={(e) => atualizarLinha(linha.id, 'reps', e.target.value)}
                placeholder="Reps"
                className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                value={linha.carga}
                onChange={(e) => atualizarLinha(linha.id, 'carga', e.target.value)}
                placeholder="Carga"
                className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                value={linha.descanso}
                onChange={(e) => atualizarLinha(linha.id, 'descanso', e.target.value)}
                placeholder="Descanso"
                className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                value={linha.nota}
                onChange={(e) => atualizarLinha(linha.id, 'nota', e.target.value)}
                placeholder="Nota"
                className="col-span-2 rounded-md border border-black/10 px-2 py-1.5 text-xs sm:col-span-3 dark:border-white/10 dark:bg-zinc-900"
              />
            </div>
          ))}
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
        escolher={(nome) => {
          if (seletorPara) atualizarLinha(seletorPara, 'nome', nome)
        }}
      />

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
              onChange={(e) => setCorreu(e.target.value as typeof correu)}
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
        <button
          type="submit"
          disabled={!podeGuardar}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#ccc]"
        >
          Guardar treino
        </button>
      </div>
      {!podeGuardar && (
        <p className="text-right text-xs text-zinc-500">
          Escreve a nota para o próximo treino antes de guardar.
        </p>
      )}
    </form>
  )
}
