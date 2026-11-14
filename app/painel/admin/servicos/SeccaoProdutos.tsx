import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import TituloSeccao from '@/components/TituloSeccao'
import {
  apagarCategoriaProduto,
  apagarProduto,
  atualizarProduto,
  criarCategoriaProduto,
  criarProduto,
  renomearCategoriaProduto,
} from './actions'

export type CategoriaProduto = { id: number; nome: string; ordem: number }
export type Produto = { id: string; categoria_id: number; nome: string; valor: number; ativo: boolean }

const inputCls =
  'rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30'
const botaoSec = 'rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold hover:bg-brand/[.08]'

function SelectCategoria({ categorias, valor }: { categorias: CategoriaProduto[]; valor?: number }) {
  return (
    <select name="categoria_id" required defaultValue={valor ?? ''} className={`${inputCls} w-40`}>
      {valor === undefined && <option value="">Categoria…</option>}
      {categorias.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  )
}

// Produtos à venda no estúdio (bar, merchandising…), agrupados por
// categoria. Mesmo aspeto da lista de serviços logo acima.
export default function SeccaoProdutos({ categorias, produtos }: { categorias: CategoriaProduto[]; produtos: Produto[] }) {
  return (
    <section id="produtos" className="scroll-mt-24">
      <TituloSeccao cor="laranja">Produtos</TituloSeccao>
      <p className="mt-1 text-xs text-zinc-500">
        O que se vende para além dos serviços — bar, merchandising e outras categorias que criares.
      </p>

      <form action={criarProduto} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong p-3">
        <input name="nome" required placeholder="Nome do produto" className={`${inputCls} flex-1 basis-40`} />
        <SelectCategoria categorias={categorias} />
        <input name="valor" inputMode="decimal" required placeholder="Preço (€)" className={`${inputCls} w-24`} />
        <SubmitButton pendingText="A criar…" className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong">
          + Produto
        </SubmitButton>
      </form>

      <div className="mt-4 flex flex-col gap-5">
        {categorias.map((c) => {
          const doGrupo = produtos.filter((p) => p.categoria_id === c.id)
          return (
            <div key={c.id}>
              <div className="flex flex-wrap items-center gap-2">
                <form action={renomearCategoriaProduto} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="nome" required defaultValue={c.nome} aria-label="Nome da categoria" className={`${inputCls} w-48 py-1.5 font-bold`} />
                  <SubmitButton pendingText="…" className={botaoSec}>
                    Mudar nome
                  </SubmitButton>
                </form>
                <span className="text-xs text-zinc-500">
                  {doGrupo.length} produto{doGrupo.length === 1 ? '' : 's'}
                </span>
                {doGrupo.length === 0 && (
                  <ConfirmarAcao action={apagarCategoriaProduto} confirmacao={`Eliminar a categoria "${c.nome}"?`} className="ml-auto">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-xs font-semibold text-red-600 underline dark:text-red-400">
                      Eliminar categoria
                    </button>
                  </ConfirmarAcao>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {doGrupo.length === 0 && <p className="text-xs text-zinc-500">Ainda sem produtos nesta categoria.</p>}
                {doGrupo.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3">
                    <form action={atualizarProduto} className="flex flex-1 flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="nome" required defaultValue={p.nome} className={`${inputCls} flex-1 basis-40`} />
                      <SelectCategoria categorias={categorias} valor={p.categoria_id} />
                      <input name="valor" inputMode="decimal" required defaultValue={String(p.valor).replace('.', ',')} className={`${inputCls} w-24`} />
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo
                      </label>
                      <SubmitButton pendingText="…" className={botaoSec}>
                        Guardar
                      </SubmitButton>
                    </form>
                    <ConfirmarAcao action={apagarProduto} confirmacao={`Eliminar o produto "${p.nome}"?`}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-xs font-semibold text-red-600 underline dark:text-red-400">
                        Eliminar
                      </button>
                    </ConfirmarAcao>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <form action={criarCategoriaProduto} className="mt-4 flex flex-wrap items-center gap-2">
        <input name="nome" required placeholder="Nova categoria (ex.: Suplementos)" className={`${inputCls} w-64`} />
        <SubmitButton pendingText="…" className={botaoSec}>
          + Categoria
        </SubmitButton>
      </form>
    </section>
  )
}
