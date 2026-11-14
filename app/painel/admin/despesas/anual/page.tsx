import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { getEstudios } from '@/lib/data/estudios'
import { CATEGORIA_AJUSTE, gerarDespesasRecorrentes, hojeEmLisboa } from '@/lib/data/despesas'
import { desbloquearAdmin } from '../../actions'
import PortaSenha from '@/components/PortaSenha'
import { guardarGrelhaDespesas } from '../actions'
import { Mensagens, ROTA_DESPESAS, SeparadoresDespesas, botaoSecCls } from '../partes'
import GrelhaAnual, { type BlocoGrelha, type LinhaGrelha } from './GrelhaAnual'

const ROTA = `${ROTA_DESPESAS}/anual`
const SEM_SUB = 'Geral (sem subcategoria)'

export default async function DespesasAnualPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; estudio?: string; error?: string; ok?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return <PortaSenha titulo="Administração — Despesas (vista anual)" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const hoje = hojeEmLisboa()
  const ano = /^\d{4}$/.test(sp.ano ?? '') ? Number(sp.ano) : Number(hoje.slice(0, 4))
  const estudios = await getEstudios(supabase)
  // A tabela é de um estúdio de cada vez (cada célula é um valor desse
  // estúdio) — sem escolha, abre no primeiro.
  const estudio = estudios.find((e) => e.slug === sp.estudio) ?? estudios[0]

  try {
    await gerarDespesasRecorrentes(supabase, hoje)
  } catch (e) {
    console.error('Despesas recorrentes não geradas:', e)
  }

  const [{ data: categoriasData, error: erroCat }, { data: despesasData, error }] = await Promise.all([
    supabase.from('despesa_categorias').select('nome, ordem, ativo, subs:despesa_subcategorias(nome, ativo)').order('ordem'),
    supabase
      .from('despesas')
      .select('data, categoria, subcategoria, valor, pago')
      .eq('estudio_id', estudio.id)
      .is('anulado_em', null)
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
      .limit(5000),
  ])
  if (erroCat || error) throw new Error((erroCat ?? error)!.message)

  // Soma por categoria → subcategoria → mês.
  type Celulas = { valores: number[]; n: number[]; porPagar: boolean[] }
  const dados = new Map<string, Map<string, Celulas>>()
  for (const d of despesasData ?? []) {
    const porSub = dados.get(d.categoria) ?? new Map<string, Celulas>()
    const sub = d.subcategoria ?? ''
    const c = porSub.get(sub) ?? { valores: Array(12).fill(0), n: Array(12).fill(0), porPagar: Array(12).fill(false) }
    const m = Number(d.data.slice(5, 7)) - 1
    c.valores[m] = Math.round((c.valores[m] + Number(d.valor)) * 100) / 100
    c.n[m]++
    if (!d.pago) c.porPagar[m] = true
    porSub.set(sub, c)
    dados.set(d.categoria, porSub)
  }
  const vazia = (): Celulas => ({ valores: Array(12).fill(0), n: Array(12).fill(0), porPagar: Array(12).fill(false) })
  const linha = (sub: string | null, rotulo: string, c: Celulas | undefined): LinhaGrelha => {
    const x = c ?? vazia()
    return { sub, rotulo, valores: x.valores, varios: x.n.map((n) => n > 1), porPagar: x.porPagar }
  }

  const categorias = (categoriasData ?? []) as { nome: string; ativo: boolean; subs: { nome: string; ativo: boolean }[] | null }[]
  const blocos: BlocoGrelha[] = []
  const usadas = new Set<string>()
  for (const cat of categorias) {
    const porSub = dados.get(cat.nome)
    usadas.add(cat.nome)
    if (!cat.ativo && !porSub) continue
    const subs = (cat.subs ?? [])
      .filter((s) => s.ativo || porSub?.has(s.nome))
      .map((s) => s.nome)
    // Subcategorias com valores que já não estão na lista (apagadas).
    for (const s of porSub?.keys() ?? []) if (s && !subs.includes(s)) subs.push(s)
    subs.sort((a, b) => a.localeCompare(b, 'pt'))
    const linhas = subs.map((s) => linha(s, s, porSub?.get(s)))
    if (porSub?.has('') || subs.length === 0) linhas.push(linha(null, subs.length === 0 ? cat.nome : SEM_SUB, porSub?.get('')))
    blocos.push({ categoria: cat.nome, soLeitura: false, linhas })
  }
  // Categorias só presentes nos dados (ex.: o acerto com o Excel) — só leitura.
  for (const [nome, porSub] of dados) {
    if (usadas.has(nome)) continue
    blocos.push({
      categoria: nome,
      soLeitura: true,
      linhas: [...porSub.entries()].map(([s, c]) => linha(s || null, s || (nome === CATEGORIA_AJUSTE ? 'Acerto com o total do Excel' : SEM_SUB), c)),
    })
  }

  const link = (a: number, slug = estudio.slug) => `${ROTA}?ano=${a}&estudio=${slug}`

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Despesas — vista anual</h1>
      <p className="mt-1 text-sm text-muted">
        A tabela do Excel: categorias e subcategorias à esquerda, meses em cima. Escreve o valor na célula e guarda — entra
        nas Despesas do mês e no Financeiro.
      </p>

      <SeparadoresDespesas ativo={ROTA} qs={`?estudio=${estudio.slug}`} />
      <Mensagens error={sp.error} ok={sp.ok} />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={link(ano - 1)} className={botaoSecCls} aria-label="Ano anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-16 text-center text-lg font-bold text-foreground">{ano}</span>
          <Link href={link(ano + 1)} className={botaoSecCls} aria-label="Ano seguinte">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {estudios.map((e) => (
            <Link
              key={e.id}
              href={link(ano, e.slug)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                e.id === estudio.id ? 'bg-brand text-black' : 'border border-border-subtle text-muted hover:text-foreground'
              }`}
            >
              {e.nome}
            </Link>
          ))}
        </div>
      </div>

      <GrelhaAnual
        key={`${estudio.id}-${ano}`}
        blocos={blocos}
        ano={ano}
        estudioId={estudio.id}
        mesAtual={ano === Number(hoje.slice(0, 4)) ? Number(hoje.slice(5, 7)) - 1 : -1}
        voltar={link(ano)}
        action={guardarGrelhaDespesas}
      />
    </div>
  )
}
