import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada, chaveConfigSenha } from '@/lib/data/gate'
import { criarPlano, atualizarPlano, apagarPlano, guardarConfig, guardarSenha } from './actions'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import type { ConfigLinha, Plano } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

// Estas chaves de "config" têm forms dedicados (write-only, nunca
// mostram o valor atual) — não devem aparecer na lista genérica de
// "Definições do negócio". As de aniversário editam-se em Clientes →
// Aniversários, onde já são usadas.
const CHAVES_ESCONDIDAS = [
  'msg_aniversario',
  'msg_aniversario_ex',
  chaveConfigSenha('admin'),
  chaveConfigSenha('coordenacao'),
]

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const { error, erroSenha } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração"
        destino="/painel/admin/servicos"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  const [{ data: planosData, error: erroPlanos }, { data: configData, error: erroConfig }] =
    await Promise.all([
      supabase.from('planos').select('*').order('valor'),
      supabase.from('config').select('*').order('chave'),
    ])

  if (erroPlanos || erroConfig) {
    throw new Error((erroPlanos ?? erroConfig)!.message)
  }

  const planos = (planosData ?? []) as Plano[]
  const config = ((configData ?? []) as ConfigLinha[]).filter(
    (c) => !CHAVES_ESCONDIDAS.includes(c.chave)
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Administração
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Serviços / Produtos
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Valores dos planos (partilhados por todos os estúdios), definições do negócio e acessos.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {planos.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <form action={atualizarPlano} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input
                name="nome"
                defaultValue={p.nome}
                className={`${inputCls} flex-1 basis-40`}
              />
              <input
                name="valor"
                type="number"
                step="0.01"
                defaultValue={p.valor}
                className={`${inputCls} w-24`}
              />
              <input
                name="sessoes_por_semana"
                type="number"
                placeholder="sessões/sem"
                defaultValue={p.sessoes_por_semana ?? ''}
                className={`${inputCls} w-28`}
              />
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo
              </label>
              <SubmitButton
                pendingText="…"
                className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Guardar
              </SubmitButton>
            </form>
            <form action={apagarPlano}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton
                pendingText="…"
                aria-label="Eliminar serviço"
                className="shrink-0 text-lg text-zinc-400 hover:text-red-600"
              >
                ×
              </SubmitButton>
            </form>
          </div>
        ))}
        {planos.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
            Ainda não há serviços registados.
          </div>
        )}
      </div>

      <form
        action={criarPlano}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-black/20 p-3 dark:border-white/20"
      >
        <input name="nome" required placeholder="Nome do serviço" className={`${inputCls} flex-1 basis-40`} />
        <input
          name="valor"
          type="number"
          step="0.01"
          required
          placeholder="Valor (€)"
          className={`${inputCls} w-24`}
        />
        <input
          name="sessoes_por_semana"
          type="number"
          placeholder="sessões/sem"
          className={`${inputCls} w-28`}
        />
        <SubmitButton
          pendingText="A criar…"
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
        >
          + Serviço
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        Eliminar um serviço já usado em pagamentos antigos pode não ser possível — nesse caso,
        desmarca &quot;ativo&quot; em vez de eliminar.
      </p>

      <TituloSeccao cor="vermelho">Passwords de acesso</TituloSeccao>
      <p className="mt-2 text-xs text-zinc-500">
        Passwords extra, separadas do login normal, para entrar em Administração e em
        Coordenação. Deixa em branco e guarda para não alterar a password atual.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form
          action={guardarSenha}
          className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
        >
          <input type="hidden" name="chave" value={chaveConfigSenha('admin')} />
          <label className="text-xs font-medium text-zinc-500">Password de Administração</label>
          <div className="flex items-end gap-2">
            <input type="password" name="senha" placeholder="Nova password" className={`${inputCls} flex-1`} />
            <SubmitButton
              pendingText="…"
              className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
        <form
          action={guardarSenha}
          className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
        >
          <input type="hidden" name="chave" value={chaveConfigSenha('coordenacao')} />
          <label className="text-xs font-medium text-zinc-500">Password de Coordenação</label>
          <div className="flex items-end gap-2">
            <input type="password" name="senha" placeholder="Nova password" className={`${inputCls} flex-1`} />
            <SubmitButton
              pendingText="…"
              className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
      </div>

      <TituloSeccao cor="neutro">Definições do negócio</TituloSeccao>
      <div className="mt-2 flex flex-col gap-2">
        {config.map((c) => (
          <form
            key={c.chave}
            action={guardarConfig}
            className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <input type="hidden" name="chave" value={c.chave} />
            <label className="text-xs font-medium text-zinc-500">{c.chave}</label>
            <div className="flex items-end gap-2">
              {c.chave.includes('msg') ? (
                <textarea name="valor" defaultValue={c.valor ?? ''} rows={2} className={`${inputCls} flex-1`} />
              ) : (
                <input name="valor" defaultValue={c.valor ?? ''} className={`${inputCls} flex-1`} />
              )}
              <SubmitButton
                pendingText="…"
                className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Guardar
              </SubmitButton>
            </div>
          </form>
        ))}
        {config.length === 0 && (
          <p className="text-sm text-zinc-500">Sem definições configuradas.</p>
        )}
      </div>
    </div>
  )
}
