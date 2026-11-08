import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { treinosPrevistos, intervaloMes, MESES } from '@/lib/data/presencas'
import ListaPresencas, { type LinhaPresenca } from './ListaPresencas'

export default async function PresencasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ ano?: string; mes?: string }>
}) {
  const { estudio: slug } = await params
  const agora = new Date()
  const { ano: anoParam, mes: mesParam } = await searchParams
  const ano = anoParam ? Number(anoParam) : agora.getFullYear()
  const mes = mesParam ? Number(mesParam) : agora.getMonth() + 1

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, frequencia_semanal')
    .eq('estudio_id', estudio.id)
    .eq('estado', 'Ativo')
    .order('nome')

  const ids = (clientes ?? []).map((c) => c.id)
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const hoje = new Date().toISOString().slice(0, 10)

  // Estas duas só precisam dos ids dos clientes, não dos resultados uma
  // da outra — correm ao mesmo tempo.
  const [
    { data: presencas, error: erroPresencas },
    { data: pagamentosData, error: erroPagamentos },
  ] = ids.length
    ? await Promise.all([
        supabase
          .from('presencas')
          .select('cliente_id, estado')
          .in('cliente_id', ids)
          .gte('data', inicio)
          .lt('data', fimExclusivo),
        // Só a validade mais distante de cada cliente interessa aqui —
        // é o que diz se está pago para hoje, independentemente de qual
        // pagamento a cobre.
        supabase.from('pagamentos').select('cliente_id, valido_ate').in('cliente_id', ids),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ]

  if (erroPresencas || erroPagamentos) {
    throw new Error((erroPresencas ?? erroPagamentos)!.message)
  }

  const statsPorCliente = new Map<string, { feitos: number; faltas: number; avisadas: number }>()
  for (const p of presencas ?? []) {
    const s = statsPorCliente.get(p.cliente_id) ?? { feitos: 0, faltas: 0, avisadas: 0 }
    if (p.estado === 'Presente') s.feitos++
    else if (p.estado === 'Faltou') s.faltas++
    else if (p.estado === 'Faltou (avisou)') s.avisadas++
    statsPorCliente.set(p.cliente_id, s)
  }

  const validadeMaximaPorCliente = new Map<string, string>()
  for (const p of pagamentosData ?? []) {
    const atual = validadeMaximaPorCliente.get(p.cliente_id)
    if (!atual || p.valido_ate > atual) {
      validadeMaximaPorCliente.set(p.cliente_id, p.valido_ate)
    }
  }

  const mesAnterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
  const mesSeguinte = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }

  const linhas: LinhaPresenca[] = (clientes ?? []).map((c) => {
    const s = statsPorCliente.get(c.id) ?? { feitos: 0, faltas: 0, avisadas: 0 }
    const alvo = treinosPrevistos(c.frequencia_semanal, ano, mes)?.arredondado ?? null
    const pct = alvo ? Math.min(100, Math.round((s.feitos / alvo) * 100)) : null
    const validade = validadeMaximaPorCliente.get(c.id)
    return {
      id: c.id,
      nome: c.nome,
      feitos: s.feitos,
      faltas: s.faltas,
      avisadas: s.avisadas,
      alvo,
      pct,
      pago: validade != null && validade >= hoje,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        Presenças
      </h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · quem treinou e quem faltou este mês.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/painel/${slug}/presencas?ano=${mesAnterior.ano}&mes=${mesAnterior.mes}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {MESES[mes - 1]} {ano}
        </span>
        <Link
          href={`/painel/${slug}/presencas?ano=${mesSeguinte.ano}&mes=${mesSeguinte.mes}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
      </div>

      <ListaPresencas linhas={linhas} slug={slug} ano={ano} mes={mes} />
    </div>
  )
}
