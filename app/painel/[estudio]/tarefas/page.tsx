import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import VistaTarefas, { type ParametrosTarefas } from '@/components/tarefas/VistaTarefas'

// As tarefas são da empresa toda (não de um estúdio): aqui vê-se a
// mesma lista que na Coordenação e na Administração. Estar dentro de
// cada estúdio serve para a equipa a consultar na conta do estúdio — e
// uma tarefa nova fica, por omissão, desse estúdio.
export default async function TarefasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<ParametrosTarefas>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams
  const supabase = await createClient()
  if (!(await getEstudioPorSlug(supabase, slug))) notFound()
  return <VistaTarefas base={`/painel/${slug}/tarefas`} sp={sp} estudioSlug={slug} />
}
