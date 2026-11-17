import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { diasDaSemana, inicioDaSemana } from '@/lib/data/horarios'
import { carregarServicos } from '@/lib/data/servicos'
import { carregarClientesDoServico, carregarOcupacaoSemana, resumir } from '@/lib/data/gestaoServicoGrupo'
import ConteudoAulas, { type ParamsAulas } from './ConteudoAulas'
import GestaoServico from './GestaoServico'

// A página de um serviço de grupo (Treino Acompanhado ou Pilates), tudo
// isolado: números, pagamentos em atraso, quem não tem aulas marcadas,
// os clientes do serviço, e por baixo as aulas da semana e o horário só
// deste serviço.
export default async function PaginaServicoGrupo({
  slug,
  chave,
  sp,
}: {
  slug: string
  chave: string
  sp: ParamsAulas & { inativos?: string }
}) {
  const supabase = await createClient()
  const [estudio, servicos] = await Promise.all([getEstudioPorSlug(supabase, slug), carregarServicos(supabase)])
  const servico = servicos.find((s) => s.chave === chave)
  if (!estudio || !servico) notFound()

  const hoje = hojeEmLisboa()
  const dias = diasDaSemana(inicioDaSemana(hoje))
  const [clientes, ocupacao] = await Promise.all([
    carregarClientesDoServico(supabase, estudio.id, servico.id, hoje),
    carregarOcupacaoSemana(supabase, estudio.id, servico.id, dias[0], dias[6]),
  ])
  const basePath = `/painel/${slug}/${chave}`
  const mostrarInativos = sp.inativos === '1'
  const qs = new URLSearchParams()
  if (sp.data) qs.set('data', sp.data)
  if (!mostrarInativos) qs.set('inativos', '1')
  const hrefInativos = `${basePath}${qs.toString() ? `?${qs}` : ''}`

  return (
    <ConteudoAulas
      slug={slug}
      sp={sp}
      basePath={basePath}
      titulo={servico.nome}
      servicoFixo={servico.id}
      antes={
        <GestaoServico
          slug={slug}
          servicoNome={servico.nome}
          clientes={clientes}
          resumo={resumir(clientes, hoje, ocupacao)}
          hoje={hoje}
          mostrarInativos={mostrarInativos}
          hrefInativos={hrefInativos}
        />
      }
    />
  )
}
