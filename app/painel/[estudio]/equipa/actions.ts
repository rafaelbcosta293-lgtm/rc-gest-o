'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { eliminarInstrutorDeVez } from '@/lib/data/eliminarInstrutor'

// "destino" deixa este toggle ser usado tanto na página Equipa como
// dentro de Coordenação → Horários (para gerir quem entra na escala) —
// volta sempre para onde foi chamado. Coordenação já não é por
// estúdio, por isso esses destinos são a página combinada, sem o slug
// à frente.
export async function alternarAcesso(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const perfilId = formData.get('perfil_id') as string
  const temAcesso = formData.get('tem_acesso') === '1'
  const destino = (formData.get('destino') as string) || 'equipa'
  const destinosCombinados = ['coordenacao', 'coordenacao/horarios']
  const caminhoDestino = destinosCombinados.includes(destino) ? `/painel/${destino}` : `/painel/${slug}/${destino}`

  const supabase = await createClient()

  const { error } = temAcesso
    ? await supabase
        .from('perfis_estudios')
        .delete()
        .eq('estudio_id', estudioId)
        .eq('perfil_id', perfilId)
    : await supabase.from('perfis_estudios').insert({ estudio_id: estudioId, perfil_id: perfilId })

  if (error) {
    redirect(`${caminhoDestino}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${slug}/equipa`)
  revalidatePath('/painel/coordenacao/horarios')
  redirect(caminhoDestino)
}

export async function mudarPapel(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const perfilId = formData.get('perfil_id') as string
  const papel = formData.get('papel') as string

  const supabase = await createClient()
  const { error } = await supabase.from('perfis').update({ papel }).eq('id', perfilId)

  if (error) {
    redirect(`/painel/${slug}/equipa?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${slug}/equipa`)
  redirect(`/painel/${slug}/equipa`)
}

// Eliminar um instrutor de vez (só a administração): sai da equipa e a
// conta de acesso é destruída; o histórico (escalas, horas, férias,
// ausências…) fica guardado — ver lib/data/eliminarInstrutor.ts. As
// contas fixas do negócio e a própria conta nunca se eliminam aqui.
export async function eliminarDaEquipa(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const id = String(formData.get('perfil_id') ?? '')
  const destino = /^[a-z0-9-]+$/.test(slug) ? `/painel/${slug}/equipa` : '/painel'
  const voltar = (params: Record<string, string>): never => {
    revalidatePath(destino)
    revalidatePath('/painel/admin/contas')
    redirect(`${destino}?${new URLSearchParams(params).toString()}`)
  }

  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin) voltar({ error: 'Só a administração pode eliminar instrutores.' })
  if (!id || id === sessao.userId) voltar({ error: 'Não podes eliminar a tua própria conta.' })

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    return voltar({ error: (e as Error).message })
  }
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user) voltar({ error: 'Conta não encontrada.' })
  if (ehContaFixa(data.user!.email ?? null)) voltar({ error: 'As contas fixas do negócio não se eliminam.' })

  const resultado = await eliminarInstrutorDeVez(admin, id)
  if (!resultado.ok) voltar({ error: `Não foi possível eliminar: ${resultado.motivo}` })
  voltar({ ok: 'eliminado' })
}
