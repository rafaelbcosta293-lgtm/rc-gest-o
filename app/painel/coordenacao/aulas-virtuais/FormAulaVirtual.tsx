'use client'

import { useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import { CATEGORIAS_SUGERIDAS, NIVEIS_AULA_VIRTUAL, extrairIdYoutube, ligacaoYoutube, miniaturaYoutube, type AulaVirtual } from '@/lib/data/aulasVirtuais'
import { guardarAulaVirtual } from './actions'

const campoCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-brand pointer-coarse:py-2.5 pointer-coarse:text-base'
const rotuloCls = 'flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted'

// O formulário de uma aula virtual (nova, ou a editar uma que já existe).
// Ao colar a ligação do YouTube mostra logo a capa do vídeo, para se
// confirmar que é o certo antes de guardar.
export default function FormAulaVirtual({ aula, categorias }: { aula?: AulaVirtual; categorias: string[] }) {
  const [ligacao, setLigacao] = useState(aula ? ligacaoYoutube(aula.youtube_id) : '')
  const id = extrairIdYoutube(ligacao)
  const lista = [...new Set([...categorias, ...CATEGORIAS_SUGERIDAS])]
  const idLista = `categorias-${aula?.id ?? 'nova'}`

  return (
    <form action={guardarAulaVirtual} className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
      {aula && <input type="hidden" name="id" value={aula.id} />}

      <div className="flex flex-col gap-1">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border-subtle bg-zinc-100 dark:bg-zinc-900">
          {id ? (
            // eslint-disable-next-line @next/next/no-img-element -- capa servida pelo YouTube
            <img src={miniaturaYoutube(id)} alt="Capa do vídeo" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
              {ligacao.trim() ? 'Não reconheço esta ligação do YouTube.' : 'A capa do vídeo aparece aqui.'}
            </span>
          )}
        </div>
        {id && (
          <a href={ligacaoYoutube(id)} target="_blank" rel="noreferrer" className="text-xs text-muted underline hover:text-foreground">
            Abrir no YouTube
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className={`${rotuloCls} col-span-2 sm:col-span-4`}>
          Ligação do vídeo no YouTube
          <input
            name="ligacao"
            required
            value={ligacao}
            onChange={(e) => setLigacao(e.target.value)}
            placeholder="https://youtu.be/…"
            autoComplete="off"
            inputMode="url"
            className={campoCls}
          />
        </label>
        <label className={`${rotuloCls} col-span-2 sm:col-span-4`}>
          Título
          <input name="titulo" required maxLength={120} defaultValue={aula?.titulo ?? ''} placeholder="ex.: Pilates para a coluna — 20 minutos" className={campoCls} />
        </label>
        <label className={`${rotuloCls} col-span-2`}>
          Categoria
          <input name="categoria" required maxLength={40} list={idLista} defaultValue={aula?.categoria ?? ''} placeholder="ex.: Pilates" autoComplete="off" className={campoCls} />
          <datalist id={idLista}>
            {lista.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={rotuloCls}>
          Nível
          <select name="nivel" defaultValue={aula?.nivel ?? ''} className={campoCls}>
            <option value="">Para todos</option>
            {NIVEIS_AULA_VIRTUAL.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={rotuloCls}>
          Duração (min)
          <input name="duracao_min" type="number" inputMode="numeric" min={1} max={600} defaultValue={aula?.duracao_min ?? ''} className={campoCls} />
        </label>
        <label className={`${rotuloCls} col-span-2 sm:col-span-4`}>
          Descrição (opcional)
          <textarea name="descricao" rows={2} defaultValue={aula?.descricao ?? ''} placeholder="O que se trabalha, material necessário…" className={campoCls} />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm text-foreground sm:col-span-3">
          <input type="checkbox" name="publicada" defaultChecked={aula ? aula.publicada : true} className="h-4 w-4 accent-[var(--accent)]" />
          Publicada (aparece na app dos clientes com o serviço)
        </label>
        <SubmitButton
          pendingText="A guardar…"
          className="col-span-2 justify-self-end rounded-full bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-strong sm:col-span-1 pointer-coarse:py-2.5 pointer-coarse:text-sm"
        >
          {aula ? 'Guardar' : 'Adicionar aula'}
        </SubmitButton>
      </div>
    </form>
  )
}
