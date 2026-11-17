import { redirect } from 'next/navigation'
import type { ParametrosTarefas } from '@/components/tarefas/VistaTarefas'

// As Tarefas passaram da Administração para a Coordenação. Este endereço
// fica só para quem o tem guardado: leva para a página nova, com os
// mesmos filtros.
export default async function TarefasAdminPage({ searchParams }: { searchParams: Promise<ParametrosTarefas> }) {
  const sp = await searchParams
  const qs = new URLSearchParams(Object.entries(sp).filter((par): par is [string, string] => typeof par[1] === 'string' && par[1] !== '')).toString()
  redirect(`/painel/coordenacao/tarefas${qs ? `?${qs}` : ''}`)
}
