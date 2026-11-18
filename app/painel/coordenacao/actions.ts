'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { somarDias } from '@/lib/data/horarios'
import { tentarDesbloquear } from '@/lib/data/gate'
import { getSessaoAtual } from '@/lib/data/sessao'
import { avisarEquipaDeHorarioNovo } from '@/lib/data/avisosHorario'
import { redirect } from 'next/navigation'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function desbloquearCoordenacao(formData: FormData) {
  const destino = (formData.get('destino') as string) || '/painel/coordenacao'
  const senha = formData.get('senha') as string
  const supabase = await createClient()

  const ok = await tentarDesbloquear(supabase, 'coordenacao', senha)
  if (!ok) {
    redirect(`${destino}?erroSenha=1`)
  }

  redirect(destino)
}

type AtribuicaoSlot = { data: string; hora: number; minuto: number; pt_ids: string[] }

type LinhaEscala = { estudio_id: number; data: string; hora: number; minuto: number; pt_id: string }

// Deixa a escala de uma semana igual a "linhas". Primeiro acrescenta-se
// o que é novo e só depois se tira o que saiu. Antes apagava-se a semana
// inteira e voltava-se a inserir tudo: se a inserção falhasse (foi o que
// aconteceu com um turno às 21:00), a semana ficava vazia na base de
// dados. Assim, uma falha deixa a escala tal como estava. Devolve a
// mensagem de erro (ou null) e se a escala ficou diferente do que estava.
async function substituirSemana(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estudioId: number,
  semana: string,
  linhas: LinhaEscala[]
): Promise<{ erro: string | null; mudou: boolean }> {
  const { data: existentes, error: erroLer } = await supabase
    .from('escalas')
    .select('id, data, hora, minuto, pt_id')
    .eq('estudio_id', estudioId)
    .gte('data', semana)
    .lt('data', somarDias(semana, 7))
  if (erroLer) return { erro: erroLer.message, mudou: false }

  const chave = (l: { data: string; hora: number; minuto: number; pt_id: string }) =>
    `${l.data}|${l.hora}|${l.minuto}|${l.pt_id}`
  const pretendidas = new Set(linhas.map(chave))
  const jaGravadas = new Set((existentes ?? []).map(chave))
  // Sem repetidos: o mesmo instrutor duas vezes no mesmo bloco violaria
  // a regra de unicidade da tabela.
  const vistas = new Set<string>()
  const aInserir = linhas.filter((l) => {
    const k = chave(l)
    if (jaGravadas.has(k) || vistas.has(k)) return false
    vistas.add(k)
    return true
  })
  const aRemover = (existentes ?? []).filter((l) => !pretendidas.has(chave(l))).map((l) => l.id as string)

  if (aInserir.length > 0) {
    const { error } = await supabase.from('escalas').insert(aInserir)
    if (error) return { erro: error.message, mudou: false }
  }
  if (aRemover.length > 0) {
    const { error } = await supabase.from('escalas').delete().in('id', aRemover)
    if (error) return { erro: error.message, mudou: aInserir.length > 0 }
  }
  return { erro: null, mudou: aInserir.length > 0 || aRemover.length > 0 }
}

// Depois de a escala mudar, avisa a equipa do estúdio (cada um na sua
// conta) de que há horário novo para consultar.
async function avisarSeMudou(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estudioId: number,
  semana: string,
  mudou: boolean
) {
  if (!mudou) return
  const sessao = await getSessaoAtual()
  await avisarEquipaDeHorarioNovo(supabase, { estudioId, semana, autorId: sessao.userId })
  revalidatePath('/painel', 'layout')
}

// Chamado diretamente da grelha (sem <form>/redirect): substitui a
// escala inteira dessa semana pelo que foi montado no ecrã, de uma só
// vez — em vez de gravar bloco a bloco (o que obrigava a recarregar a
// página, perder a posição do scroll, a cada alteração).
export async function guardarSemana(input: {
  estudioSlug: string
  estudioId: number
  semana: string
  atribuicoes: AtribuicaoSlot[]
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()

  const linhas = input.atribuicoes.flatMap((s) =>
    s.pt_ids.map((pt_id) => ({
      estudio_id: input.estudioId,
      data: s.data,
      hora: s.hora,
      minuto: s.minuto,
      pt_id,
    }))
  )
  const { erro, mudou } = await substituirSemana(supabase, input.estudioId, input.semana, linhas)
  await avisarSeMudou(supabase, input.estudioId, input.semana, mudou)
  if (erro) return { error: erro }

  revalidatePath('/painel/coordenacao/horarios')
  revalidatePath(`/painel/${input.estudioSlug}/horarios`)
  return { ok: true }
}

// Copia a escala da semana anterior para a semana aberta (substitui o
// que lá estiver), para depois só se fazerem os ajustes. Só copia quem
// ainda tem acesso a este estúdio.
export async function copiarSemanaAnterior(formData: FormData) {
  const estudioSlug = String(formData.get('estudio_slug') ?? '')
  const estudioId = Number(formData.get('estudio_id'))
  const semana = String(formData.get('semana') ?? '')
  const destino = new URL(String(formData.get('voltar') ?? '/painel/coordenacao/horarios'), 'http://x')
  const voltar = (resultado: string): never => {
    destino.searchParams.set(`${estudioSlug}_copia`, resultado)
    // Obriga a grelha a recarregar com a escala copiada.
    destino.searchParams.set(`${estudioSlug}_v`, String(Date.now()))
    redirect(`${destino.pathname}${destino.search}#planeamento-${estudioSlug}`)
  }
  if (!estudioId || !/^\d{4}-\d{2}-\d{2}$/.test(semana)) voltar('erro')

  const supabase = await createClient()
  const semanaAnterior = somarDias(semana, -7)
  const [{ data: anteriores, error }, { data: ligacoes }] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt_id')
      .eq('estudio_id', estudioId)
      .gte('data', semanaAnterior)
      .lt('data', semana),
    supabase.from('perfis_estudios').select('perfil_id').eq('estudio_id', estudioId),
  ])
  if (error) voltar('erro')
  const comAcesso = new Set((ligacoes ?? []).map((l) => l.perfil_id))
  const linhas = (anteriores ?? [])
    .filter((t) => comAcesso.has(t.pt_id))
    .map((t) => ({ estudio_id: estudioId, data: somarDias(t.data, 7), hora: t.hora, minuto: t.minuto, pt_id: t.pt_id }))
  if (linhas.length === 0) voltar('vazia')

  const copia = await substituirSemana(supabase, estudioId, semana, linhas)
  await avisarSeMudou(supabase, estudioId, semana, copia.mudou)
  if (copia.erro) voltar('erro')

  revalidatePath('/painel/coordenacao/horarios')
  revalidatePath(`/painel/${estudioSlug}/horarios`)
  voltar('ok')
}

// Cria a conta e a ficha do instrutor de uma vez (sem ele ter de se
// registar sozinho) e já lhe dá acesso a este estúdio. Usa a chave de
// administrador porque criar contas não é algo que uma conta normal
// tenha permissão para fazer. Fica com uma password aleatória que
// ninguém fica a saber — se um dia quiser entrar na app, usa
// "Esqueci-me da password" com o email que aqui ficou registado.
export async function criarInstrutor(formData: FormData) {
  const estudioId = Number(formData.get('estudio_id'))
  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const telefone = campoOuNull(formData, 'telefone')

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    redirect(`/painel/coordenacao/horarios?error=${encodeURIComponent((e as Error).message)}`)
  }

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { nome },
  })

  if (erroCriar || !criado.user) {
    redirect(
      `/painel/coordenacao/horarios?error=${encodeURIComponent(erroCriar?.message ?? 'Não foi possível criar o instrutor.')}`
    )
  }

  // O perfil de equipa é sempre criado aqui (as contas novas já não
  // ganham perfil sozinhas — ver a migração 20261118030000).
  const { error: erroPerfil } = await admin
    .from('perfis')
    .upsert({ id: criado.user.id, nome, telefone: telefone || null, papel: 'pt', ativo: true, saiu_em: null })
  if (erroPerfil) {
    redirect(`/painel/coordenacao/horarios?error=${encodeURIComponent(erroPerfil.message)}`)
  }

  const { error: erroAcesso } = await admin
    .from('perfis_estudios')
    .insert({ estudio_id: estudioId, perfil_id: criado.user.id })

  if (erroAcesso) {
    redirect(`/painel/coordenacao/horarios?error=${encodeURIComponent(erroAcesso.message)}`)
  }

  revalidatePath('/painel/coordenacao/horarios')
  redirect('/painel/coordenacao/horarios')
}
