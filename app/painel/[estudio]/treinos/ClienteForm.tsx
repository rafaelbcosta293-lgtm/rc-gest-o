'use client'

import { ALERTAS } from '@/lib/data/constantes'
import type { Cliente, Perfil } from '@/lib/supabase/database.types'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

const inputCls =
  'rounded-md border border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/50 dark:border-white/30 dark:bg-zinc-900'
const labelCls = 'text-sm font-medium text-foreground/80'

// Sugestões (pode escrever-se outra coisa): escolher da lista mantém os
// nomes sempre escritos da mesma maneira, para a estatística bater certo.
const PAISES = ['Portugal', 'Espanha', 'França', 'Suíça', 'Alemanha', 'Luxemburgo', 'Reino Unido', 'Brasil', 'Angola', 'Cabo Verde', 'Moçambique', 'Estados Unidos']
const NACIONALIDADES = ['Portuguesa', 'Espanhola', 'Francesa', 'Suíça', 'Alemã', 'Luxemburguesa', 'Britânica', 'Brasileira', 'Angolana', 'Cabo-verdiana', 'Moçambicana', 'Americana']

export default function ClienteForm({
  estudioSlug,
  estudioId,
  cliente,
  pts,
  action,
  error,
  voltar,
  servicos = [],
  servicosLigados,
}: {
  estudioSlug: string
  estudioId: number
  cliente?: Cliente
  pts: Pick<Perfil, 'id' | 'nome'>[]
  action: (formData: FormData) => void
  error?: string
  voltar?: string
  // Serviços do estúdio e aqueles em que o cliente está (por omissão,
  // num cliente novo, só o Treino Personalizado).
  servicos?: { id: number; nome: string }[]
  servicosLigados?: number[]
}) {
  const ligados = servicosLigados ?? [1]
  const { marcarSujo } = useAvisoSairSemGuardar()

  return (
    <form action={action} onChange={marcarSujo} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      {voltar && <input type="hidden" name="voltar" value={voltar} />}

      {servicos.length > 0 && (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-subtle px-3 py-2">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Serviços</legend>
          <input type="hidden" name="servicos_enviados" value="1" />
          {servicos.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 text-sm text-foreground">
              <input type="checkbox" name="servicos" value={s.id} defaultChecked={ligados.includes(s.id)} className="h-4 w-4 accent-[var(--accent)]" />
              {s.nome}
            </label>
          ))}
          <span className="basis-full text-xs text-muted">
            Um serviço novo fica Pendente até ao primeiro pagamento desse serviço; tirar um serviço deixa-o Inativo (o
            histórico fica).
          </span>
        </fieldset>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className={labelCls}>
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            required
            defaultValue={cliente?.nome}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome_preferido" className={labelCls}>
            Nome preferido
          </label>
          <input
            id="nome_preferido"
            name="nome_preferido"
            defaultValue={cliente?.nome_preferido ?? ''}
            placeholder="ex.: Rui Pedro Catarino prefere ser chamado de Pedro"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefone" className={labelCls}>
            Telefone
          </label>
          <input
            id="telefone"
            name="telefone"
            defaultValue={cliente?.telefone ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={cliente?.email ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nif" className={labelCls}>
            NIF
          </label>
          <input
            id="nif"
            name="nif"
            inputMode="numeric"
            maxLength={11}
            defaultValue={cliente?.nif ?? ''}
            placeholder="Em branco = consumidor final"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="objetivo" className={labelCls}>
            Objetivo
          </label>
          <input
            id="objetivo"
            name="objetivo"
            defaultValue={cliente?.objetivo ?? ''}
            placeholder="ex.: perda de massa gorda"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="frequencia_semanal" className={labelCls}>
            Treinos por semana
          </label>
          <select
            id="frequencia_semanal"
            name="frequencia_semanal"
            defaultValue={cliente?.frequencia_semanal ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}× por semana
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nascimento" className={labelCls}>
            Data de nascimento
          </label>
          <input
            id="nascimento"
            name="nascimento"
            type="date"
            defaultValue={cliente?.nascimento ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="genero" className={labelCls}>
            Género
          </label>
          <select id="genero" name="genero" defaultValue={cliente?.genero ?? ''} className={inputCls}>
            <option value="">—</option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pt_principal_id" className={labelCls}>
            PT principal
          </label>
          <select
            id="pt_principal_id"
            name="pt_principal_id"
            defaultValue={cliente?.pt_principal_id ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="alerta" className={labelCls}>
            Alerta ativo
          </label>
          <select
            id="alerta"
            name="alerta"
            defaultValue={cliente?.alerta ?? 'Nenhum'}
            className={inputCls}
          >
            {Object.keys(ALERTAS).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="alerta_detalhe" className={labelCls}>
            Detalhe do alerta
          </label>
          <input
            id="alerta_detalhe"
            name="alerta_detalhe"
            defaultValue={cliente?.alerta_detalhe ?? ''}
            placeholder="ex.: ombro direito — evitar press"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="evento" className={labelCls}>
            Prova / evento
          </label>
          <input
            id="evento"
            name="evento"
            defaultValue={cliente?.evento ?? ''}
            placeholder="ex.: Meia Maratona"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="evento_data" className={labelCls}>
            Data do evento
          </label>
          <input
            id="evento_data"
            name="evento_data"
            type="date"
            defaultValue={cliente?.evento_data ?? ''}
            className={inputCls}
          />
        </div>

        {cliente && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="estado" className={labelCls}>
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={cliente.estado}
              className={inputCls}
            >
              <option value="Ativo">Ativo</option>
              <option value="Pendente">Pendente</option>
              <option value="Suspenso">Suspenso</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        )}
      </div>

      {/* Morada em campos separados (rua, nº, código postal, cidade,
          país) — para depois se poder fazer estatística por zona. */}
      <fieldset className="rounded-lg border border-border-subtle px-3 pt-2 pb-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Morada</legend>
        <div className="grid grid-cols-6 gap-x-4 gap-y-3">
          <div className="col-span-6 flex flex-col gap-1.5 sm:col-span-4">
            <label htmlFor="morada" className={labelCls}>
              Rua
            </label>
            <input id="morada" name="morada" autoComplete="off" defaultValue={cliente?.morada ?? ''} placeholder="ex.: Rua da Sobreira" className={inputCls} />
          </div>
          <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="morada_numero" className={labelCls}>
              Nº / andar
            </label>
            <input id="morada_numero" name="morada_numero" autoComplete="off" defaultValue={cliente?.morada_numero ?? ''} placeholder="ex.: 14, 2.º Esq." className={inputCls} />
          </div>
          <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="codigo_postal" className={labelCls}>
              Código postal
            </label>
            <input id="codigo_postal" name="codigo_postal" autoComplete="off" defaultValue={cliente?.codigo_postal ?? ''} placeholder="0000-000" className={inputCls} />
          </div>
          <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="cidade" className={labelCls}>
              Cidade
            </label>
            <input id="cidade" name="cidade" autoComplete="off" defaultValue={cliente?.cidade ?? ''} placeholder="ex.: Fátima" className={inputCls} />
          </div>
          <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="pais" className={labelCls}>
              País
            </label>
            <input id="pais" name="pais" list="lista-paises" autoComplete="off" defaultValue={cliente?.pais ?? ''} placeholder="ex.: Portugal" className={inputCls} />
            <datalist id="lista-paises">
              {PAISES.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nacionalidade" className={labelCls}>
            Nacionalidade
          </label>
          <input id="nacionalidade" name="nacionalidade" list="lista-nacionalidades" autoComplete="off" defaultValue={cliente?.nacionalidade ?? ''} placeholder="ex.: Portuguesa" className={inputCls} />
          <datalist id="lista-nacionalidades">
            {NACIONALIDADES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cartao_cidadao" className={labelCls}>
            Cartão de cidadão
          </label>
          <input id="cartao_cidadao" name="cartao_cidadao" autoComplete="off" maxLength={20} defaultValue={cliente?.cartao_cidadao ?? ''} placeholder="ex.: 12345678 9 ZZ0" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profissao" className={labelCls}>
            Profissão
          </label>
          <input id="profissao" name="profissao" autoComplete="off" defaultValue={cliente?.profissao ?? ''} placeholder="ex.: Professora" className={inputCls} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notas" className={labelCls}>
          Notas gerais
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          defaultValue={cliente?.notas ?? ''}
          className={inputCls}
        />
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="mt-2 self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        {cliente ? 'Guardar alterações' : 'Criar cliente'}
      </SubmitButton>
    </form>
  )
}
