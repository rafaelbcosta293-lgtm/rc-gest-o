import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIA_AJUSTE, type EstadoDespesa, ROTULO_ESTADO } from '@/lib/data/despesas'
import type { CategoriaOpcao } from './CamposCategoria'

export const ROTA_DESPESAS = '/painel/admin/despesas'

export const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand'
export const botaoCls = 'rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong'
export const botaoSecCls =
  'rounded-full border border-border-strong px-3 py-1 text-xs font-semibold text-foreground hover:bg-brand/[.08]'

export const eur = (v: number) =>
  `${v < 0 ? '−' : ''}€${Math.abs(v)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`

export const dataPt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeMes = (mes: string) => `${NOMES_MES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

const COR_ESTADO: Record<EstadoDespesa, string> = {
  paga: 'bg-emerald-500/15 text-emerald-300',
  em_atraso: 'bg-red-500/15 text-red-300',
  a_vencer: 'bg-amber-500/15 text-amber-300',
  por_pagar: 'bg-zinc-500/15 text-zinc-300',
}

export function EtiquetaEstado({ estado }: { estado: EstadoDespesa }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_ESTADO[estado]}`}>
      {ROTULO_ESTADO[estado]}
    </span>
  )
}

const SEPARADORES = [
  { href: ROTA_DESPESAS, label: 'Despesas do mês' },
  { href: `${ROTA_DESPESAS}/anual`, label: 'Vista anual (tabela)' },
  { href: `${ROTA_DESPESAS}/recorrentes`, label: 'Recorrentes e avisos' },
  { href: `${ROTA_DESPESAS}/categorias`, label: 'Categorias' },
]

export function SeparadoresDespesas({ ativo, qs = '' }: { ativo: string; qs?: string }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      {SEPARADORES.map((s) => (
        <Link
          key={s.href}
          href={`${s.href}${qs}`}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
            s.href === ativo ? 'bg-brand text-black' : 'border border-border-subtle text-muted hover:text-foreground'
          }`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  )
}

export function Mensagens({ error, ok }: { error?: string; ok?: string }) {
  const TEXTOS: Record<string, string> = {
    criada: 'Despesa registada.',
    editada: 'Despesa atualizada.',
    paga: 'Despesa marcada como paga.',
    'por-pagar': 'Despesa voltou a ficar por pagar.',
    anulada: 'Despesa anulada.',
    grelha: 'Tabela guardada.',
    'recorrente-criada': 'Despesa recorrente criada — as próximas ocorrências já estão no balanço.',
    'recorrente-editada': 'Despesa recorrente atualizada.',
    'recorrente-ativa': 'Despesa recorrente reativada.',
    'recorrente-parada': 'Despesa recorrente parada — deixou de gerar novas ocorrências.',
    'recorrente-eliminada': 'Despesa recorrente eliminada.',
    'categoria-criada': 'Categoria criada.',
    'subcategoria-criada': 'Subcategoria criada.',
    'categoria-renomeada': 'Categoria renomeada (as despesas já lançadas acompanham o novo nome).',
    'subcategoria-renomeada': 'Subcategoria renomeada (as despesas já lançadas acompanham o novo nome).',
    desativada: 'Desativada — deixa de aparecer nas listas de escolha.',
    reativada: 'Reativada.',
  }
  return (
    <>
      {error && <p className="mt-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}
      {ok && TEXTOS[ok] && <p className="mt-4 rounded-md bg-emerald-950 px-3 py-2 text-sm text-emerald-300">{TEXTOS[ok]}</p>}
    </>
  )
}

// Categorias ativas com as suas subcategorias ativas, pela ordem do Excel.
export async function carregarCategorias(supabase: SupabaseClient): Promise<CategoriaOpcao[]> {
  const { data, error } = await supabase
    .from('despesa_categorias')
    .select('nome, ordem, ativo, subs:despesa_subcategorias(nome, ativo)')
    .order('ordem')
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((c) => c.ativo && c.nome !== CATEGORIA_AJUSTE)
    .map((c) => ({
      nome: c.nome,
      subs: ((c.subs ?? []) as { nome: string; ativo: boolean }[])
        .filter((s) => s.ativo)
        .map((s) => s.nome)
        .sort((a, b) => a.localeCompare(b, 'pt')),
    }))
}
