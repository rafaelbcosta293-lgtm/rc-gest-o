import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { diferencasAuditoria } from '@/lib/data/auditoria'
import PortaSenha from '@/components/PortaSenha'
import type { RegistoAuditoria } from '@/lib/supabase/database.types'

const TABELAS = ['pagamentos', 'planos', 'config'] as const
const COR_ACAO: Record<string, string> = {
  INSERT: 'text-emerald-600 dark:text-emerald-400',
  UPDATE: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-red-600 dark:text-red-400',
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; tabela?: string }>
}) {
  const { erroSenha, tabela } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Auditoria"
        destino="/painel/admin/auditoria"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  let query = supabase
    .from('auditoria')
    .select('*, perfil:perfis!alterado_por(nome)')
    .order('criado_em', { ascending: false })
    .limit(100)
  if (tabela && (TABELAS as readonly string[]).includes(tabela)) {
    query = query.eq('tabela', tabela)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const registos = (data ?? []) as unknown as (RegistoAuditoria & { perfil: { nome: string } | null })[]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Registo de auditoria</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Quem alterou pagamentos, planos e preços, e quando — últimos 100 registos.
      </p>

      <div className="mt-4 flex gap-2">
        <Link
          href="/painel/admin/auditoria"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!tabela ? 'border-brand bg-brand/10' : 'border-border-subtle'}`}
        >
          Todas
        </Link>
        {TABELAS.map((t) => (
          <Link
            key={t}
            href={`/painel/admin/auditoria?tabela=${t}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tabela === t ? 'border-brand bg-brand/10' : 'border-border-subtle'}`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {registos.length === 0 && <p className="text-sm text-muted">Sem registos.</p>}
        {registos.map((r) => {
          const diferencas = diferencasAuditoria(r.dados_antigos, r.dados_novos)
          return (
            <div key={r.id} className="rounded-xl border border-border-subtle bg-surface p-3 text-sm shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{new Date(r.criado_em).toLocaleString('pt-PT')}</span>
                <span className={`font-semibold ${COR_ACAO[r.acao] ?? ''}`}>{r.acao}</span>
                <span>· {r.tabela}</span>
                <span>· {r.perfil?.nome ?? 'sistema'}</span>
              </div>
              {diferencas.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {diferencas.map((d) => (
                    <li key={d.campo} className="font-mono text-xs text-foreground">
                      {d.campo}: <span className="text-muted">{JSON.stringify(d.de)}</span> →{' '}
                      {JSON.stringify(d.para)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  {r.acao === 'INSERT' ? 'criado' : r.acao === 'DELETE' ? 'apagado' : 'sem alterações relevantes'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
