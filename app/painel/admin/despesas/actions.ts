'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import { gerarDespesasRecorrentes, hojeEmLisboa, PERIODICIDADES } from '@/lib/data/despesas'

const ROTA = '/painel/admin/despesas'

function texto(formData: FormData, nome: string): string | null {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function numero(formData: FormData, nome: string): number | null {
  const v = texto(formData, nome)
  if (v == null) return null
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function voltar(formData: FormData, extra: Record<string, string> = {}): never {
  const destino = texto(formData, 'voltar') ?? ROTA
  const url = new URL(destino, 'http://x')
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  url.searchParams.delete(extra.error ? 'ok' : 'error')
  revalidatePath(ROTA, 'layout')
  redirect(`${url.pathname}${url.search}`)
}

// Só o dono entra na Administração (o RLS das tabelas confirma e_admin()).
async function clienteAdmin() {
  const sessao = await getSessaoAtual()
  if (!podeAcederAdmin(sessao.email)) redirect('/painel?erro=sem-acesso')
  return createClient()
}

// ── Despesas ─────────────────────────────────────────────────────────

export async function guardarDespesa(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = texto(formData, 'id')
  const estudioId = numero(formData, 'estudio_id')
  const categoria = texto(formData, 'categoria')
  const valor = numero(formData, 'valor')
  const data = texto(formData, 'data')
  const pago = formData.get('pago') === 'on'
  if (!estudioId || !categoria || valor == null || !data) {
    voltar(formData, { error: 'Indica o estúdio, a categoria, o valor e a data.' })
  }
  if (valor < 0) voltar(formData, { error: 'O valor não pode ser negativo.' })
  const vencimento = texto(formData, 'vencimento') ?? data
  const linha = {
    estudio_id: estudioId,
    categoria,
    subcategoria: texto(formData, 'subcategoria'),
    descricao: texto(formData, 'descricao'),
    valor,
    data,
    vencimento,
    pago,
    pago_em: pago ? (texto(formData, 'pago_em') ?? hojeEmLisboa()) : null,
    dias_aviso: numero(formData, 'dias_aviso') ?? 3,
  }
  let erro: string | null = null
  if (id) {
    // Numa ocorrência de uma recorrente a data é a do calendário da
    // recorrente (é ela que impede a ocorrência de ser gerada de novo):
    // muda-se o dia na própria recorrente, não aqui.
    const { data: atual } = await supabase.from('despesas').select('recorrente_id').eq('id', id).maybeSingle()
    const alteracao = atual?.recorrente_id
      ? { ...linha, data: undefined, vencimento: undefined, estudio_id: undefined }
      : linha
    erro = (await supabase.from('despesas').update(alteracao).eq('id', id)).error?.message ?? null
  } else {
    erro = (await supabase.from('despesas').insert({ ...linha, origem: 'app' })).error?.message ?? null
  }
  const error = erro ? { message: erro } : null
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: id ? 'editada' : 'criada' })
}

export async function marcarDespesaPaga(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = texto(formData, 'id')
  const pago = formData.get('pago') === 'true'
  if (!id) voltar(formData)
  const { error } = await supabase
    .from('despesas')
    .update({ pago, pago_em: pago ? hojeEmLisboa() : null })
    .eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: pago ? 'paga' : 'por-pagar' })
}

export async function anularDespesa(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = texto(formData, 'id')
  if (!id) voltar(formData)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('despesas')
    .update({ anulado_em: new Date().toISOString(), anulado_por: user?.id ?? null, motivo_anulacao: 'Anulada na Administração' })
    .eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'anulada' })
}

// ── Vista anual (tabela) ─────────────────────────────────────────────

// Grava as células alteradas na tabela do ano. Cada célula é o total de
// uma subcategoria num mês:
//  • sem lançamentos → cria um (no dia 1 desse mês);
//  • com um lançamento → muda-lhe o valor (ou anula-o, se ficar a zero);
//  • com vários → acerta a diferença no mais recente; se não chegar,
//    junta-os num só com o novo total.
export async function guardarGrelhaDespesas(formData: FormData) {
  const supabase = await clienteAdmin()
  const estudioId = numero(formData, 'estudio_id')
  const ano = numero(formData, 'ano')
  let alteracoes: { categoria: string; subcategoria: string | null; mes: number; valor: number }[] = []
  try {
    alteracoes = JSON.parse(String(formData.get('alteracoes') ?? '[]'))
  } catch {
    alteracoes = []
  }
  alteracoes = alteracoes.filter(
    (a) =>
      a && typeof a.categoria === 'string' && a.categoria && Number.isInteger(a.mes) && a.mes >= 1 && a.mes <= 12 &&
      typeof a.valor === 'number' && Number.isFinite(a.valor) && a.valor >= 0
  )
  if (!estudioId || !ano || alteracoes.length === 0) voltar(formData)

  const { data: existentes, error: erroLer } = await supabase
    .from('despesas')
    .select('id, data, categoria, subcategoria, valor, criado_em')
    .eq('estudio_id', estudioId)
    .is('anulado_em', null)
    .gte('data', `${ano}-01-01`)
    .lte('data', `${ano}-12-31`)
    .order('data')
    .order('criado_em')
    .limit(5000)
  if (erroLer) voltar(formData, { error: erroLer.message })

  const anular = { anulado_em: new Date().toISOString(), motivo_anulacao: 'Alterado na vista anual' }
  const r2 = (n: number) => Math.round(n * 100) / 100
  for (const a of alteracoes) {
    const mes = `${ano}-${String(a.mes).padStart(2, '0')}`
    const sub = a.subcategoria?.trim() || null
    const linhas = (existentes ?? []).filter(
      (d) => d.categoria === a.categoria && (d.subcategoria ?? null) === sub && d.data.startsWith(mes)
    )
    const atual = r2(linhas.reduce((s, d) => s + Number(d.valor), 0))
    const novo = r2(a.valor)
    if (novo === atual) continue
    const ids = linhas.map((d) => d.id)
    let erro: string | null = null
    if (novo === 0) {
      erro = (await supabase.from('despesas').update(anular).in('id', ids)).error?.message ?? null
    } else if (linhas.length === 0) {
      erro =
        (
          await supabase.from('despesas').insert({
            estudio_id: estudioId,
            categoria: a.categoria,
            subcategoria: sub,
            valor: novo,
            data: `${mes}-01`,
            origem: 'app',
            pago: true,
          })
        ).error?.message ?? null
    } else {
      const ultima = linhas[linhas.length - 1]
      const valorUltima = r2(Number(ultima.valor) + (novo - atual))
      if (valorUltima > 0) {
        erro = (await supabase.from('despesas').update({ valor: valorUltima }).eq('id', ultima.id)).error?.message ?? null
      } else {
        const outras = ids.filter((id) => id !== ultima.id)
        erro = (await supabase.from('despesas').update(anular).in('id', outras)).error?.message ?? null
        if (!erro) erro = (await supabase.from('despesas').update({ valor: novo }).eq('id', ultima.id)).error?.message ?? null
      }
    }
    if (erro) voltar(formData, { error: `${a.subcategoria ?? a.categoria} (${mes}): ${erro}` })
  }
  voltar(formData, { ok: 'grelha' })
}

// ── Recorrentes ──────────────────────────────────────────────────────

export async function guardarRecorrente(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = texto(formData, 'id')
  const estudioId = numero(formData, 'estudio_id')
  const categoria = texto(formData, 'categoria')
  const valor = numero(formData, 'valor')
  const dia = numero(formData, 'dia_vencimento')
  const inicio = texto(formData, 'inicio')
  const periodicidade = texto(formData, 'periodicidade') ?? 'mensal'
  const diasAviso = numero(formData, 'dias_aviso') ?? 3
  if (!estudioId || !categoria || valor == null || !dia || !inicio) {
    voltar(formData, { error: 'Indica o estúdio, a categoria, o valor, o dia de pagamento e o primeiro vencimento.' })
  }
  if (!PERIODICIDADES.some((p) => p.valor === periodicidade)) voltar(formData, { error: 'Periodicidade inválida.' })
  if (dia < 1 || dia > 31) voltar(formData, { error: 'O dia de pagamento tem de ser entre 1 e 31.' })
  if (diasAviso < 0 || diasAviso > 60) voltar(formData, { error: 'O aviso tem de ser entre 0 e 60 dias antes.' })

  const linha = {
    estudio_id: estudioId,
    categoria,
    subcategoria: texto(formData, 'subcategoria'),
    descricao: texto(formData, 'descricao'),
    valor,
    periodicidade,
    dia_vencimento: dia,
    inicio,
    fim: texto(formData, 'fim'),
    dias_aviso: diasAviso,
  }
  const { data: guardada, error } = id
    ? await supabase.from('despesas_recorrentes').update(linha).eq('id', id).select('id').single()
    : await supabase.from('despesas_recorrentes').insert(linha).select('id').single()
  if (error) voltar(formData, { error: error.message })

  // Ocorrências futuras ainda por pagar acompanham a alteração (valor,
  // aviso, categoria…); as já pagas ficam como estão.
  if (id && guardada) {
    await supabase
      .from('despesas')
      .update({
        valor: linha.valor,
        categoria: linha.categoria,
        subcategoria: linha.subcategoria,
        descricao: linha.descricao,
        dias_aviso: linha.dias_aviso,
      })
      .eq('recorrente_id', id)
      .eq('pago', false)
      .is('anulado_em', null)
      .gte('vencimento', hojeEmLisboa())
  }
  await gerarDespesasRecorrentes(supabase, hojeEmLisboa())
  voltar(formData, { ok: id ? 'recorrente-editada' : 'recorrente-criada' })
}

export async function alternarRecorrente(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = texto(formData, 'id')
  const ativo = formData.get('ativo') === 'true'
  if (!id) voltar(formData)
  const { error } = await supabase.from('despesas_recorrentes').update({ ativo }).eq('id', id)
  if (error) voltar(formData, { error: error.message })
  if (!ativo) {
    // Parar: as ocorrências futuras ainda por pagar deixam de contar.
    await supabase
      .from('despesas')
      .update({ anulado_em: new Date().toISOString(), motivo_anulacao: 'Recorrente desativada' })
      .eq('recorrente_id', id)
      .eq('pago', false)
      .is('anulado_em', null)
      .gt('vencimento', hojeEmLisboa())
  } else {
    await gerarDespesasRecorrentes(supabase, hojeEmLisboa())
  }
  voltar(formData, { ok: ativo ? 'recorrente-ativa' : 'recorrente-parada' })
}

export async function eliminarRecorrente(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = texto(formData, 'id')
  if (!id) voltar(formData)
  // As ocorrências já pagas ficam (fazem parte das contas); as futuras
  // por pagar são anuladas.
  await supabase
    .from('despesas')
    .update({ anulado_em: new Date().toISOString(), motivo_anulacao: 'Recorrente eliminada' })
    .eq('recorrente_id', id)
    .eq('pago', false)
    .is('anulado_em', null)
    .gt('vencimento', hojeEmLisboa())
  const { error } = await supabase.from('despesas_recorrentes').delete().eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'recorrente-eliminada' })
}

// ── Categorias ───────────────────────────────────────────────────────

export async function criarCategoria(formData: FormData) {
  const supabase = await clienteAdmin()
  const nome = texto(formData, 'nome')
  if (!nome) voltar(formData, { error: 'Indica o nome da categoria.' })
  const { data: ultima } = await supabase
    .from('despesa_categorias')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { error } = await supabase.from('despesa_categorias').insert({ nome, ordem: (ultima?.ordem ?? 0) + 1 })
  if (error) voltar(formData, { error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message })
  voltar(formData, { ok: 'categoria-criada' })
}

export async function criarSubcategoria(formData: FormData) {
  const supabase = await clienteAdmin()
  const categoriaId = numero(formData, 'categoria_id')
  const nome = texto(formData, 'nome')
  if (!categoriaId || !nome) voltar(formData, { error: 'Indica o nome da subcategoria.' })
  const { error } = await supabase.from('despesa_subcategorias').insert({ categoria_id: categoriaId, nome })
  if (error) voltar(formData, { error: error.code === '23505' ? 'Essa subcategoria já existe nesta categoria.' : error.message })
  voltar(formData, { ok: 'subcategoria-criada' })
}

// Renomear também atualiza as despesas e recorrentes já lançadas com o
// nome antigo, para o histórico continuar agrupado na mesma categoria.
export async function renomearCategoria(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = numero(formData, 'id')
  const nome = texto(formData, 'nome')
  if (!id || !nome) voltar(formData, { error: 'Indica o novo nome.' })
  const { data: atual } = await supabase.from('despesa_categorias').select('nome').eq('id', id).single()
  if (!atual) voltar(formData, { error: 'Categoria não encontrada.' })
  if (atual.nome === nome) voltar(formData)
  const { error } = await supabase.from('despesa_categorias').update({ nome }).eq('id', id)
  if (error) voltar(formData, { error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message })
  await Promise.all([
    supabase.from('despesas').update({ categoria: nome }).eq('categoria', atual.nome),
    supabase.from('despesas_recorrentes').update({ categoria: nome }).eq('categoria', atual.nome),
  ])
  voltar(formData, { ok: 'categoria-renomeada' })
}

export async function renomearSubcategoria(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = numero(formData, 'id')
  const nome = texto(formData, 'nome')
  if (!id || !nome) voltar(formData, { error: 'Indica o novo nome.' })
  const { data: atual } = await supabase
    .from('despesa_subcategorias')
    .select('nome, categoria:despesa_categorias(nome)')
    .eq('id', id)
    .single()
  if (!atual) voltar(formData, { error: 'Subcategoria não encontrada.' })
  if (atual.nome === nome) voltar(formData)
  const cat = (Array.isArray(atual.categoria) ? atual.categoria[0] : atual.categoria) as { nome: string } | null
  const { error } = await supabase.from('despesa_subcategorias').update({ nome }).eq('id', id)
  if (error) voltar(formData, { error: error.code === '23505' ? 'Essa subcategoria já existe nesta categoria.' : error.message })
  if (cat) {
    await Promise.all([
      supabase.from('despesas').update({ subcategoria: nome }).eq('categoria', cat.nome).eq('subcategoria', atual.nome),
      supabase.from('despesas_recorrentes').update({ subcategoria: nome }).eq('categoria', cat.nome).eq('subcategoria', atual.nome),
    ])
  }
  voltar(formData, { ok: 'subcategoria-renomeada' })
}

// Desativar esconde das listas de escolha, sem tocar no histórico.
export async function alternarCategoria(formData: FormData) {
  const supabase = await clienteAdmin()
  const id = numero(formData, 'id')
  const tabela = formData.get('tipo') === 'sub' ? 'despesa_subcategorias' : 'despesa_categorias'
  const ativo = formData.get('ativo') === 'true'
  if (!id) voltar(formData)
  const { error } = await supabase.from(tabela).update({ ativo }).eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: ativo ? 'reativada' : 'desativada' })
}
