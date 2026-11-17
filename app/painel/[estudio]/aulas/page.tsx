import Link from '@/components/LinkRapido'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { diasDaSemana, inicioDaSemana } from '@/lib/data/horarios'
import { carregarServicos } from '@/lib/data/servicos'
import { carregarClientesDoServico, carregarOcupacaoSemana, resumir } from '@/lib/data/gestaoServicoGrupo'
import ConteudoAulas, { type ParamsAulas } from './ConteudoAulas'
import { ResumoCartoes } from './GestaoServico'

// A pasta "Aulas de grupo": o resumo de cada serviço (com o atalho para a
// página dele) e a semana com as aulas de todos.
export default async function AulasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<ParamsAulas>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const [estudio, servicos] = await Promise.all([getEstudioPorSlug(supabase, slug), carregarServicos(supabase, { soAtivos: true })])
  if (!estudio) notFound()

  const hoje = hojeEmLisboa()
  const dias = diasDaSemana(inicioDaSemana(hoje))
  const grupo = servicos.filter((s) => s.formato === 'grupo')
  const resumos = await Promise.all(
    grupo.map(async (s) => {
      const [clientes, ocupacao] = await Promise.all([
        carregarClientesDoServico(supabase, estudio.id, s.id, hoje),
        carregarOcupacaoSemana(supabase, estudio.id, s.id, dias[0], dias[6]),
      ])
      return { servico: s, resumo: resumir(clientes, hoje, ocupacao) }
    })
  )

  return (
    <ConteudoAulas
      slug={slug}
      sp={sp}
      basePath={`/painel/${slug}/aulas`}
      titulo="Aulas de grupo"
      antes={
        <div className="mt-4 flex flex-col gap-3">
          {resumos.map(({ servico, resumo }) => (
            <section key={servico.id} className="rounded-xl border border-border-subtle bg-surface/60 p-3">
              <Link
                href={`/painel/${slug}/${servico.chave}`}
                className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-foreground hover:underline"
              >
                {servico.nome} <ChevronRight className="h-4 w-4" />
              </Link>
              <ResumoCartoes resumo={resumo} />
            </section>
          ))}
        </div>
      }
    />
  )
}
