'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import {
  rascunhoDoFormulario,
  problemasParaEmitir,
  precoSemIva,
  chaveProduto,
  chaveMetodo,
  normalizarNif,
  nifValido,
  type RascunhoFatura,
} from '@/lib/data/faturas'
import {
  ErroZsgo,
  procurarClientePorNif,
  criarCliente,
  emitirDocumentoVenda,
  listarClientesZsgo,
  type ClienteListadoZsgo,
} from '@/lib/zsgo'
import { normalizarTexto } from '@/lib/texto'

const PAGINA = '/painel/admin/faturas'

function voltar(id: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString()
  redirect(`${PAGINA}?${q}#pedido-${id}`)
}

async function exigirAdmin() {
  const sessao = await getSessaoAtual()
  if (!podeAcederAdmin(sessao.email)) redirect('/painel?erro=sem-acesso')
}

async function guardar(id: string, rascunho: RascunhoFatura) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos_fatura')
    .update({ rascunho, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .in('estado', ['pendente', 'erro'])
  return error?.message ?? null
}

export async function guardarRascunhoFatura(formData: FormData) {
  await exigirAdmin()
  const id = formData.get('id') as string
  const erro = await guardar(id, rascunhoDoFormulario(formData))
  revalidatePath(PAGINA)
  if (erro) voltar(id, { error: erro })
  voltar(id, { ok: 'Rascunho guardado.' })
}

export async function rejeitarPedidoFatura(formData: FormData) {
  await exigirAdmin()
  const id = formData.get('id') as string
  const motivo = (formData.get('motivo') as string | null)?.trim() || null
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('pedidos_fatura')
    .update({
      estado: 'rejeitada',
      motivo_rejeicao: motivo,
      resolvido_por: userData.user?.id ?? null,
      resolvido_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .in('estado', ['pendente', 'erro'])

  revalidatePath(PAGINA)
  revalidatePath('/painel/admin', 'layout')
  if (error) voltar(id, { error: error.message })
  redirect(`${PAGINA}?ok=${encodeURIComponent('Pedido rejeitado — nenhuma fatura foi emitida.')}`)
}

// Emite a fatura no ZS Go com os dados do rascunho (tal como estão no
// formulário). Só corre depois de a Administração carregar em "Emitir".
export async function emitirPedidoFatura(formData: FormData) {
  await exigirAdmin()
  const id = formData.get('id') as string
  const rascunho = rascunhoDoFormulario(formData)
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  // 1) Guarda sempre o que está no ecrã (mesmo que a emissão falhe).
  const erroGuardar = await guardar(id, rascunho)
  if (erroGuardar) voltar(id, { error: erroGuardar })

  const problemas = problemasParaEmitir(rascunho)
  if (problemas.length) voltar(id, { error: problemas.join(' ') })

  // 2) Trinco: passa a "a_emitir" só se ainda estiver pendente/erro —
  // um segundo clique (ou outro separador) já não passa daqui.
  const { data: trancado, error: erroTrinco } = await supabase
    .from('pedidos_fatura')
    .update({ estado: 'a_emitir', ultimo_erro: null, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .in('estado', ['pendente', 'erro'])
    .select('id, pagamento_id, cliente_id, cliente:clientes(nif, zsgo_cliente_codigo)')
    .maybeSingle()

  if (erroTrinco) voltar(id, { error: erroTrinco.message })
  if (!trancado) voltar(id, { error: 'Este pedido já está a ser emitido ou já foi tratado.' })

  const clienteApp = trancado.cliente as unknown as {
    nif: string | null
    zsgo_cliente_codigo: string | null
  } | null
  const nif = normalizarNif(rascunho.cliente.nif)

  async function falhar(mensagem: string, corpo: unknown = null): Promise<never> {
    await supabase
      .from('pedidos_fatura')
      .update({
        estado: 'erro',
        ultimo_erro: mensagem,
        zsgo_resposta: corpo as object | null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
    revalidatePath(PAGINA)
    voltar(id, { error: mensagem })
  }

  // 3) Cliente no ZS Go: reaproveita o código guardado se o NIF for o
  // mesmo; senão procura pelo NIF; senão cria.
  let codigoCliente: string | null =
    clienteApp?.zsgo_cliente_codigo && normalizarNif(clienteApp.nif) === nif
      ? clienteApp.zsgo_cliente_codigo
      : null
  try {
    if (!codigoCliente && nif) codigoCliente = await procurarClientePorNif(nif)
    if (!codigoCliente) codigoCliente = await criarCliente({ ...rascunho.cliente, nif })
  } catch (e) {
    const err = e instanceof ErroZsgo ? e : null
    await falhar(
      `Cliente no ZS Go: ${e instanceof Error ? e.message : 'erro desconhecido'}`,
      err?.corpo ?? null
    )
  }

  await supabase
    .from('clientes')
    .update({ nif, zsgo_cliente_codigo: codigoCliente })
    .eq('id', trancado.cliente_id)

  // 4) Emite o documento.
  let resultado: Awaited<ReturnType<typeof emitirDocumentoVenda>> | null = null
  try {
    resultado = await emitirDocumentoVenda({
      clienteCodigo: codigoCliente as string,
      tipo: rascunho.documento.tipo,
      data: rascunho.documento.data,
      metodoPagamentoId: rascunho.documento.zsgo_metodo_id,
      referencia: `RC-${String(trancado.pagamento_id).slice(0, 8)}`,
      notas: rascunho.documento.notas,
      linhas: rascunho.linhas.map((l) => ({
        product_reference: l.produto_referencia as string,
        quantity: l.quantidade,
        unit_price_net: precoSemIva(l.preco_com_iva, l.iva),
        notes: l.descricao || null,
      })),
      emailPara: rascunho.documento.enviar_email ? rascunho.cliente.email : null,
    })
  } catch (e) {
    const err = e instanceof ErroZsgo ? e : null
    const base = e instanceof Error ? e.message : 'erro desconhecido'
    await falhar(
      err?.incerto
        ? `${base} Confirma no ZS Go (Vendas) se a fatura chegou a ser criada ANTES de tentar outra vez.`
        : base,
      err?.corpo ?? null
    )
  }

  const r = resultado!
  await supabase
    .from('pedidos_fatura')
    .update({
      estado: 'emitida',
      zsgo_documento_id: r.id,
      zsgo_numero: r.numero,
      zsgo_pdf_url: r.pdfUrl,
      zsgo_resposta: r.resposta as object,
      ultimo_erro: r.avisos.length ? r.avisos.join(' · ') : null,
      resolvido_por: userData.user?.id ?? null,
      resolvido_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  // 5) Lembra as escolhas (artigo por tipo de linha, método por método
  // da app) para os próximos rascunhos já virem bem preenchidos.
  const lembrar: { chave: string; valor: string }[] = []
  for (const l of rascunho.linhas) {
    if (l.produto_referencia && l.tipo !== 'outro') lembrar.push({ chave: chaveProduto(l.tipo), valor: l.produto_referencia })
  }
  if (rascunho.documento.metodo && rascunho.documento.zsgo_metodo_id) {
    lembrar.push({ chave: chaveMetodo(rascunho.documento.metodo), valor: rascunho.documento.zsgo_metodo_id })
  }
  if (lembrar.length) await supabase.from('config').upsert(lembrar, { onConflict: 'chave' })

  revalidatePath(PAGINA)
  revalidatePath('/painel/admin', 'layout')
  redirect(
    `${PAGINA}?ok=${encodeURIComponent(
      `Fatura ${r.numero ?? ''} emitida no ZS Go.${r.avisos.length ? ` Avisos: ${r.avisos.join(' · ')}` : ''}`
    )}`
  )
}

// Se a emissão ficou presa em "a emitir" (ex.: o servidor caiu a meio),
// volta a pôr o pedido em "erro" para se poder rever — com o aviso de
// confirmar primeiro no ZS Go se a fatura chegou a ser criada.
export async function desbloquearPedidoFatura(formData: FormData) {
  await exigirAdmin()
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase
    .from('pedidos_fatura')
    .update({
      estado: 'erro',
      ultimo_erro:
        'A emissão foi interrompida. Confirma no ZS Go (Vendas) se a fatura chegou a ser criada antes de emitir outra vez.',
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estado', 'a_emitir')
  revalidatePath(PAGINA)
  voltar(id, {})
}

export type ResultadoSincronizacaoNif = {
  atualizados: { nome: string; nif: string }[]
  ambiguosZsgo: string[]
  ambiguosApp: string[]
  semNifNoZsgo: number
  semCorrespondencia: number
}

const chaveNome = (nome: string) => normalizarTexto(nome).trim().replace(/\s+/g, ' ')

// Preenche o NIF de clientes nossos que ainda não o têm, a partir dos
// clientes já guardados no ZS Go (ex.: de faturas emitidas antes desta
// app existir) — por nome, já que é a única coisa em comum entre os
// dois lados para quem nunca teve uma fatura pedida por aqui. Só
// atualiza quando o nome é inequívoco dos dois lados (nunca um só
// nome com mais do que uma pessoa, de nenhum dos lados) e o NIF
// encontrado é válido — tudo o resto fica listado para se rever à
// mão, nunca a adivinhar.
export async function sincronizarNifsZsgo(): Promise<ResultadoSincronizacaoNif | { error: string }> {
  await exigirAdmin()
  const supabase = await createClient()

  const { data: clientesData, error: erroClientes } = await supabase
    .from('clientes')
    .select('id, nome, nif')
  if (erroClientes) return { error: erroClientes.message }
  const semNif = (clientesData ?? []).filter((c) => !c.nif) as { id: string; nome: string; nif: string | null }[]

  let doZsgo: ClienteListadoZsgo[]
  try {
    doZsgo = await listarClientesZsgo()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido ao ler clientes do ZS Go.' }
  }

  const porNomeZsgo = new Map<string, ClienteListadoZsgo[]>()
  for (const c of doZsgo) {
    const k = chaveNome(c.nome)
    porNomeZsgo.set(k, [...(porNomeZsgo.get(k) ?? []), c])
  }
  const porNomeApp = new Map<string, { id: string; nome: string }[]>()
  for (const c of semNif) {
    const k = chaveNome(c.nome)
    porNomeApp.set(k, [...(porNomeApp.get(k) ?? []), c])
  }

  const atualizados: { nome: string; nif: string }[] = []
  const ambiguosZsgo = new Set<string>()
  const ambiguosApp = new Set<string>()
  let semNifNoZsgo = 0
  let semCorrespondencia = 0

  for (const [k, nossos] of porNomeApp) {
    const correspondentes = porNomeZsgo.get(k)
    if (!correspondentes) {
      semCorrespondencia += nossos.length
      continue
    }
    if (nossos.length > 1) {
      ambiguosApp.add(nossos[0].nome)
      continue
    }
    if (correspondentes.length > 1) {
      ambiguosZsgo.add(correspondentes[0].nome)
      continue
    }
    const nif = normalizarNif(correspondentes[0].nif)
    if (!nif || !nifValido(nif)) {
      semNifNoZsgo++
      continue
    }
    const { error } = await supabase.from('clientes').update({ nif }).eq('id', nossos[0].id)
    if (!error) atualizados.push({ nome: nossos[0].nome, nif })
  }

  revalidatePath(PAGINA)
  return {
    atualizados,
    ambiguosZsgo: [...ambiguosZsgo],
    ambiguosApp: [...ambiguosApp],
    semNifNoZsgo,
    semCorrespondencia,
  }
}
