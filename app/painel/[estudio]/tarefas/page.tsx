import { redirect } from 'next/navigation'

// "Tarefas diárias" foi removida (as tabelas já não existem na base de
// dados) — isto fica só para quem tiver a rota antiga guardada não
// cair num 404, e ser levado de volta para o painel do estúdio.
export default async function TarefasPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params
  redirect(`/painel/${slug}`)
}
