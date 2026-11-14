import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import { alternarCategoria, criarCategoria, criarSubcategoria, renomearCategoria, renomearSubcategoria } from '../actions'
import { Mensagens, ROTA_DESPESAS, SeparadoresDespesas, botaoCls, botaoSecCls, inputCls } from '../partes'

const ROTA = `${ROTA_DESPESAS}/categorias`

type Sub = { id: number; nome: string; ativo: boolean }
type Categoria = { id: number; nome: string; ordem: number; ativo: boolean; subs: Sub[] }

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return <PortaSenha titulo="Administração — Categorias de despesa" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const { data, error } = await supabase
    .from('despesa_categorias')
    .select('id, nome, ordem, ativo, subs:despesa_subcategorias(id, nome, ativo)')
    .order('ordem')
  if (error) throw new Error(error.message)
  const categorias = ((data ?? []) as unknown as Categoria[]).map((c) => ({
    ...c,
    subs: [...c.subs].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt')),
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Categorias de despesa</h1>
      <p className="mt-1 text-sm text-muted">
        Começam com as categorias e subcategorias do Excel. Podes acrescentar, mudar o nome ou desativar — desativar só
        esconde das listas de escolha; mudar o nome atualiza também as despesas já lançadas.
      </p>

      <SeparadoresDespesas ativo={ROTA} />
      <Mensagens error={sp.error} ok={sp.ok} />

      <TituloSeccao cor="teal">Nova categoria</TituloSeccao>
      <form action={criarCategoria} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="voltar" value={ROTA} />
        <input name="nome" required placeholder="Nome da categoria" className={`${inputCls} min-w-64 flex-1`} />
        <SubmitButton pendingText="…" className={botaoCls}>
          Adicionar categoria
        </SubmitButton>
      </form>

      <TituloSeccao cor="roxo">Categorias</TituloSeccao>
      <div className="mt-2 flex flex-col gap-3">
        {categorias.map((c) => (
          <details key={c.id} className={`rounded-xl border border-border-subtle bg-surface ${c.ativo ? '' : 'opacity-60'}`}>
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <span className="text-sm font-bold text-foreground">{c.nome}</span>
              <span className="text-xs text-muted">
                {c.subs.filter((s) => s.ativo).length} subcategoria{c.subs.filter((s) => s.ativo).length === 1 ? '' : 's'}
                {!c.ativo && ' · desativada'}
              </span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <form action={renomearCategoria} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="voltar" value={ROTA} />
                  <input type="hidden" name="id" value={c.id} />
                  <input name="nome" required defaultValue={c.nome} className={`${inputCls} min-w-48 flex-1`} />
                  <SubmitButton pendingText="…" className={botaoSecCls}>
                    Mudar nome
                  </SubmitButton>
                </form>
                <form action={alternarCategoria}>
                  <input type="hidden" name="voltar" value={ROTA} />
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="ativo" value={c.ativo ? 'false' : 'true'} />
                  <SubmitButton pendingText="…" className={botaoSecCls}>
                    {c.ativo ? 'Desativar' : 'Reativar'}
                  </SubmitButton>
                </form>
              </div>

              <ul className="flex flex-col gap-1.5">
                {c.subs.map((s) => (
                  <li key={s.id} className={`flex flex-wrap items-center gap-2 ${s.ativo ? '' : 'opacity-50'}`}>
                    <form action={renomearSubcategoria} className="flex flex-1 items-center gap-2">
                      <input type="hidden" name="voltar" value={ROTA} />
                      <input type="hidden" name="id" value={s.id} />
                      <input name="nome" required defaultValue={s.nome} className={`${inputCls} min-w-48 flex-1 py-1.5`} />
                      <SubmitButton pendingText="…" className={botaoSecCls}>
                        Guardar
                      </SubmitButton>
                    </form>
                    <form action={alternarCategoria}>
                      <input type="hidden" name="voltar" value={ROTA} />
                      <input type="hidden" name="tipo" value="sub" />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="ativo" value={s.ativo ? 'false' : 'true'} />
                      <SubmitButton pendingText="…" className={botaoSecCls}>
                        {s.ativo ? 'Desativar' : 'Reativar'}
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>

              <form action={criarSubcategoria} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="voltar" value={ROTA} />
                <input type="hidden" name="categoria_id" value={c.id} />
                <input name="nome" required placeholder={`Nova subcategoria em ${c.nome}`} className={`${inputCls} min-w-48 flex-1 py-1.5`} />
                <SubmitButton pendingText="…" className={botaoCls}>
                  Adicionar
                </SubmitButton>
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
