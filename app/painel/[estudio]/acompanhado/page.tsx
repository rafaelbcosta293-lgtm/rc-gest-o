import PaginaServicoGrupo from '../aulas/PaginaServicoGrupo'
import type { ParamsAulas } from '../aulas/ConteudoAulas'

export default async function PaginaAcompanhado({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<ParamsAulas & { inativos?: string }>
}) {
  const { estudio: slug } = await params
  return <PaginaServicoGrupo slug={slug} chave="acompanhado" sp={await searchParams} />
}
