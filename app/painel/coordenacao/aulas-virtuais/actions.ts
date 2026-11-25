'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederCoordenacao } from '@/lib/data/acessos'
import { NIVEIS_AULA_VIRTUAL, extrairIdYoutube } from '@/lib/data/aulasVirtuais'

const ROTA = '/painel/coordenacao/aulas-virtuais'

function voltar(extra: Record<string, string>): never {
  const p = new URLSearchParams(extra)
  redirect(`${ROTA}${p.toString() ? `?${p}` : ''}`)
}

// Só o dono e a conta da Coordenação (a base de dados confirma: só a gestão escreve).
async function exigirCoordenacao() {
  const sessao = await getSessaoAtual()
  if (!podeAcederCoordenacao(sessao.email)) voltar({ error: 'Só a Coordenação pode gerir as aulas virtuais.' })
}

const texto = (f: FormData, k: string) => {
  const v = f.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

// Cria uma aula nova, ou guarda as alterações de uma que já existe ("id").
export async function guardarAulaVirtual(formData: FormData) {
  await exigirCoordenacao()
  const id = texto(formData, 'id')
  const titulo = texto(formData, 'titulo')
  const youtubeId = extrairIdYoutube(texto(formData, 'ligacao'))
  const categoria = texto(formData, 'categoria') ?? 'Geral'
  const nivel = texto(formData, 'nivel')
  const duracao = Number(formData.get('duracao_min'))
  if (!titulo) voltar({ error: 'Indica o título da aula.' })
  if (!youtubeId) voltar({ error: 'A ligação não parece ser de um vídeo do YouTube. Copia-a do botão "Partilhar" do vídeo.' })
  if (titulo!.length > 120) voltar({ error: 'O título é demasiado comprido (máx. 120 letras).' })
  if (categoria.length > 40) voltar({ error: 'A categoria é demasiado comprida (máx. 40 letras).' })
  if (nivel && !(NIVEIS_AULA_VIRTUAL as readonly string[]).includes(nivel)) voltar({ error: 'Nível inválido.' })
  if (formData.get('duracao_min') && (!Number.isInteger(duracao) || duracao < 1 || duracao > 600)) {
    voltar({ error: 'A duração tem de ficar entre 1 e 600 minutos.' })
  }

  const supabase = await createClient()
  const campos = {
    titulo,
    descricao: texto(formData, 'descricao'),
    categoria,
    nivel,
    duracao_min: formData.get('duracao_min') ? duracao : null,
    youtube_id: youtubeId,
    publicada: formData.get('publicada') === 'on',
    atualizado_em: new Date().toISOString(),
  }
  if (id) {
    const { error } = await supabase.from('aulas_virtuais').update(campos).eq('id', id)
    if (error) voltar({ error: error.message })
  } else {
    // Uma aula nova entra no fim da lista.
    const { data: ultima } = await supabase.from('aulas_virtuais').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
    const { error } = await supabase.from('aulas_virtuais').insert({ ...campos, ordem: ((ultima?.ordem as number | undefined) ?? 0) + 1 })
    if (error) voltar({ error: error.message })
  }
  revalidatePath(ROTA)
  voltar({ ok: id ? 'guardada' : campos.publicada ? 'criada-publicada' : 'criada' })
}

// Publica (passa a aparecer na app do cliente) ou esconde uma aula.
export async function publicarAulaVirtual(formData: FormData) {
  await exigirCoordenacao()
  const id = texto(formData, 'id')
  const publicar = formData.get('publicar') === '1'
  if (!id) voltar({})
  const supabase = await createClient()
  const { error } = await supabase.from('aulas_virtuais').update({ publicada: publicar, atualizado_em: new Date().toISOString() }).eq('id', id!)
  if (error) voltar({ error: error.message })
  revalidatePath(ROTA)
  voltar({ ok: publicar ? 'publicada' : 'escondida' })
}

// Sobe ou desce uma aula dentro da sua categoria (troca de lugar com a vizinha).
export async function moverAulaVirtual(formData: FormData) {
  await exigirCoordenacao()
  const id = texto(formData, 'id')
  const sentido = formData.get('sentido') === 'cima' ? -1 : 1
  if (!id) voltar({})
  const supabase = await createClient()
  const { data } = await supabase.from('aulas_virtuais').select('id, categoria, ordem, criado_em').order('ordem').order('criado_em')
  const todas = (data ?? []) as { id: string; categoria: string; ordem: number }[]
  const esta = todas.find((a) => a.id === id)
  if (!esta) voltar({})
  const daCategoria = todas.filter((a) => a.categoria === esta!.categoria)
  const i = daCategoria.findIndex((a) => a.id === id)
  const vizinha = daCategoria[i + sentido]
  if (!vizinha) voltar({})
  // Renumera a categoria inteira já com a troca feita — assim funciona
  // mesmo que duas aulas tivessem ficado com o mesmo número.
  const nova = [...daCategoria]
  nova[i] = vizinha!
  nova[i + sentido] = esta!
  const numeros = daCategoria.map((a) => a.ordem).sort((a, b) => a - b)
  for (let k = 1; k < numeros.length; k++) if (numeros[k] <= numeros[k - 1]) numeros[k] = numeros[k - 1] + 1
  for (let k = 0; k < nova.length; k++) {
    if (nova[k].ordem === numeros[k]) continue
    const { error } = await supabase.from('aulas_virtuais').update({ ordem: numeros[k] }).eq('id', nova[k].id)
    if (error) voltar({ error: error.message })
  }
  revalidatePath(ROTA)
  voltar({})
}

export async function apagarAulaVirtual(formData: FormData) {
  await exigirCoordenacao()
  const id = texto(formData, 'id')
  if (!id) voltar({})
  const supabase = await createClient()
  const { error } = await supabase.from('aulas_virtuais').delete().eq('id', id!)
  if (error) voltar({ error: error.message })
  revalidatePath(ROTA)
  voltar({ ok: 'apagada' })
}
