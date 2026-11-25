import type { SupabaseClient } from '@supabase/supabase-js'
import { primeiroNomeExibicao } from '@/lib/data/clientes'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { CHAVE_SERVICO_VIRTUAIS, montarAulasVirtuaisApp, type AulaVirtual } from '@/lib/data/aulasVirtuais'
import { ligarAppClientes } from './ligacao'
import { somarDiasIso } from './tempo'
import {
  impressao,
  montarAulas,
  montarDadosConta,
  type AulaGestao,
  type AvaliacaoGestao,
  type DadosConta,
  type EventoGestao,
  type InscricaoGestao,
  type PresencaGestao,
} from './copia'
import {
  RESPOSTAS,
  avaliarDesmarcacao,
  erroDeRegra,
  fecharDesmarcacao,
  type EventoParaDesmarcar,
  type PedidoApp,
  type RespostaPedido,
} from './pedidos'

// Sincronização gestão ⇄ app do cliente. Corre SÓ no servidor da
// gestão (rota /api/cron/app-clientes, chamada pelo pg_cron). Recebe o
// cliente "admin" da gestão e liga-se à base da app com o token de sync.

const MINUTOS_ENTRE_COPIAS = 5
const CONTAS_POR_VOLTA = 60
const DIAS_AULAS_ANTES = 7
const DIAS_AULAS_DEPOIS = 14
const DIAS_TREINOS_ANTES = 60
const DIAS_TREINOS_DEPOIS = 90
const DIAS_PRESENCAS = 365

type Conta = {
  cliente_id: string
  conta_id: string
  numero: string
  estudio_id: number
  ativa: boolean
  hash_dados: string | null
  sincronizado_em: string | null
}

export type RelatorioSync = {
  pedidos: number
  aulas: number
  aulasVirtuais: number
  contasCopiadas: number
  contasVistas: number
  removidas: number
  erros: string[]
}

const chunks = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

export async function sincronizarAppClientes(admin: SupabaseClient, agora = new Date()): Promise<RelatorioSync> {
  const { app, token } = ligarAppClientes()
  const rel: RelatorioSync = { pedidos: 0, aulas: 0, aulasVirtuais: 0, contasCopiadas: 0, contasVistas: 0, removidas: 0, erros: [] }
  const hoje = hojeEmLisboa(agora)

  // 1) Contas de clientes apagados na gestão → desligar na app.
  const { data: aRemover } = await admin.from('app_clientes_contas_a_remover').select('conta_id')
  for (const r of aRemover ?? []) {
    const { error } = await app.rpc('sync_desativar_conta', { p_token: token, p_conta: r.conta_id })
    if (error) rel.erros.push(`desativar: ${error.message}`)
    else {
      await admin.from('app_clientes_contas_a_remover').delete().eq('conta_id', r.conta_id)
      rel.removidas++
    }
  }

  const { data: contasData, error: erroContas } = await admin
    .from('app_clientes_contas')
    .select('cliente_id, conta_id, numero, estudio_id, ativa, hash_dados, sincronizado_em')
  if (erroContas) throw new Error(erroContas.message)
  const contas = (contasData ?? []) as Conta[]
  const ativas = contas.filter((c) => c.ativa)
  if (ativas.length === 0) return rel
  const porConta = new Map(ativas.map((c) => [c.conta_id, c]))

  const [{ data: estudiosData }, { data: servicosData }, { data: perfisData }] = await Promise.all([
    admin.from('estudios').select('id, slug'),
    admin.from('servicos').select('id, nome, reserva_abre_horas'),
    admin.from('perfis').select('id, nome'),
  ])
  const slugs = new Map((estudiosData ?? []).map((e) => [e.id as number, e.slug as string]))
  const servicos = new Map(
    (servicosData ?? []).map((s) => [s.id as number, { nome: s.nome as string, reserva_abre_horas: (s.reserva_abre_horas as number | null) ?? null }])
  )
  const nomes = new Map((perfisData ?? []).map((p) => [p.id as string, (p.nome as string) ?? '']))

  const afetados = new Set<string>()
  const respostas: RespostaPedido[] = []

  // 2) Pedidos de desmarcação já decididos (pela equipa ou sozinhos) e
  //    respostas que ainda não chegaram à app.
  const { data: emCurso } = await admin
    .from('app_clientes_pedidos')
    .select('id, cliente_id, alvo, estado, resposta')
    .eq('respondido_app', false)
  const jaRegistados = new Set((emCurso ?? []).map((p) => p.id as string))
  if (emCurso && emCurso.length > 0) {
    const abertos = emCurso.filter((p) => p.estado === 'em_analise')
    const eventos = abertos.length
      ? ((await admin.from('agenda_eventos').select('id, cliente_id, tipo, estado, data, hora_inicio').in('id', abertos.map((p) => p.alvo))).data ?? [])
      : []
    const evPorId = new Map((eventos as EventoParaDesmarcar[]).map((e) => [e.id, e]))
    const contaDoCliente = new Map(ativas.map((c) => [c.cliente_id, c.conta_id]))
    for (const p of emCurso) {
      let estado = p.estado as RespostaPedido['estado']
      let resposta = (p.resposta as string | null) ?? ''
      if (estado === 'em_analise') {
        const fecho = fecharDesmarcacao(evPorId.get(p.alvo as string) ?? null, agora)
        if (!fecho) continue
        estado = fecho
        resposta = fecho === 'aceite' ? RESPOSTAS.desmarcado : RESPOSTAS.foraDeTempo
        await admin.from('app_clientes_pedidos').update({ estado, resposta, tratado_em: agora.toISOString() }).eq('id', p.id).eq('estado', 'em_analise')
      }
      respostas.push({ id: p.id as string, estado, resposta })
      const conta = contaDoCliente.get(p.cliente_id as string)
      if (conta) afetados.add(conta)
    }
  }

  // 3) Pedidos novos. Um pedido já registado aqui (a resposta não chegou
  //    à app da última vez) não volta a ser aplicado.
  const { data: pedidosData, error: erroPedidos } = await app.rpc('sync_pedidos_pendentes', { p_token: token })
  if (erroPedidos) rel.erros.push(`pedidos: ${erroPedidos.message}`)
  const novos = ((pedidosData ?? []) as PedidoApp[]).filter((p) => !jaRegistados.has(p.id))
  const registados = new Map<string, RespostaPedido>()
  if (novos.length) {
    const { data } = await admin.from('app_clientes_pedidos').select('id, estado, resposta').in('id', novos.map((p) => p.id))
    for (const r of data ?? []) registados.set(r.id as string, { id: r.id as string, estado: r.estado as RespostaPedido['estado'], resposta: (r.resposta as string) ?? '' })
  }
  for (const p of novos) {
    const conta = porConta.get(p.conta_id)
    if (!conta) {
      respostas.push({ id: p.id, estado: 'recusado', resposta: RESPOSTAS.semConta })
      continue
    }
    const anterior = registados.get(p.id)
    if (anterior) {
      respostas.push(anterior) // já decidido antes: só reenviar a resposta
      continue
    }
    const r = await tratarPedido(admin, p, conta, agora)
    if (!r) continue // erro passageiro: tenta na próxima volta
    const { error } = await admin.from('app_clientes_pedidos').upsert({
      id: p.id,
      cliente_id: conta.cliente_id,
      estudio_id: conta.estudio_id,
      tipo: p.tipo,
      alvo: p.alvo,
      nota: p.nota,
      criado_em: p.criado_em,
      estado: r.estado,
      resposta: r.resposta,
      tratado_em: r.estado === 'em_analise' ? null : agora.toISOString(),
      respondido_app: false,
    })
    if (error) {
      rel.erros.push(`registo do pedido: ${error.message}`)
      continue
    }
    respostas.push(r)
    afetados.add(conta.conta_id)
  }

  if (respostas.length > 0) {
    const { error } = await app.rpc('sync_responder_pedidos', { p_token: token, p_respostas: respostas })
    if (error) rel.erros.push(`responder: ${error.message}`)
    else {
      rel.pedidos = respostas.length
      const finais = respostas.filter((r) => r.estado !== 'em_analise').map((r) => r.id)
      if (finais.length) await admin.from('app_clientes_pedidos').update({ respondido_app: true }).in('id', finais)
    }
  }

  // 4) Aulas de grupo dos estúdios com contas (vagas sempre frescas).
  const estudiosComContas = [...new Set(ativas.map((c) => c.estudio_id))]
  const desde = somarDiasIso(hoje, -DIAS_AULAS_ANTES)
  const { data: aulasData, error: erroAulas } = await admin
    .from('aulas')
    .select('id, estudio_id, servico_id, data, hora_inicio, duracao_min, instrutor_id, lotacao, estado, aulas_inscricoes(estado)')
    .in('estudio_id', estudiosComContas)
    .gte('data', desde)
    .lte('data', somarDiasIso(hoje, DIAS_AULAS_DEPOIS))
    .order('data')
    .limit(1000)
  if (erroAulas) throw new Error(erroAulas.message)
  const ocupadas = new Map<string, number>()
  for (const a of aulasData ?? []) {
    const insc = (a.aulas_inscricoes as { estado: string }[] | null) ?? []
    ocupadas.set(a.id as string, insc.filter((i) => i.estado !== 'Cancelada').length)
  }
  const aulasApp = montarAulas((aulasData ?? []) as unknown as AulaGestao[], ocupadas, servicos, nomes, slugs)
  const aulasNaApp = new Set(aulasApp.map((a) => a.id))
  {
    const { data, error } = await app.rpc('sync_substituir_aulas', {
      p_token: token,
      p_estudios: estudiosComContas.map((id) => slugs.get(id)).filter(Boolean),
      p_desde: desde,
      p_aulas: aulasApp,
    })
    if (error) rel.erros.push(`aulas: ${error.message}`)
    else rel.aulas = (data as number) ?? 0
  }

  // 4b) Aulas virtuais: os vídeos publicados e as contas com acesso (as
  //     de clientes com o serviço "Aulas Virtuais" em dia). Vai sempre
  //     tudo — a app só escreve o que mudou.
  {
    const { data: servicoVirtuais } = await admin.from('servicos').select('id').eq('chave', CHAVE_SERVICO_VIRTUAIS).maybeSingle()
    const [{ data: videos, error: erroVideos }, { data: comServico, error: erroServico }] = await Promise.all([
      admin.from('aulas_virtuais').select('*').eq('publicada', true),
      servicoVirtuais
        ? admin.from('clientes_servicos').select('cliente_id').eq('servico_id', servicoVirtuais.id).eq('estado', 'Ativo')
        : Promise.resolve({ data: [] as { cliente_id: string }[], error: null }),
    ])
    if (erroVideos || erroServico) rel.erros.push(`aulas virtuais: ${(erroVideos ?? erroServico)!.message}`)
    else {
      const emDia = new Set((comServico ?? []).map((c) => c.cliente_id as string))
      const { data, error } = await app.rpc('sync_substituir_aulas_virtuais', {
        p_token: token,
        p_aulas: montarAulasVirtuaisApp((videos ?? []) as AulaVirtual[]),
        p_contas: ativas.filter((c) => emDia.has(c.cliente_id)).map((c) => c.conta_id),
      })
      if (error) rel.erros.push(`aulas virtuais: ${error.message}`)
      else rel.aulasVirtuais = (data as number) ?? 0
    }
  }

  // 5) Cópia dos dados de cada conta (as afetadas já, as outras de 5 em 5 min).
  const limite = agora.getTime() - MINUTOS_ENTRE_COPIAS * 60_000
  const devidas = ativas
    .filter((c) => afetados.has(c.conta_id) || !c.sincronizado_em || new Date(c.sincronizado_em).getTime() < limite)
    .sort((a, b) => Number(afetados.has(b.conta_id)) - Number(afetados.has(a.conta_id)) || (a.sincronizado_em ?? '').localeCompare(b.sincronizado_em ?? ''))
    .slice(0, CONTAS_POR_VOLTA)
  if (devidas.length === 0) return rel

  const ids = devidas.map((c) => c.cliente_id)
  const [clientesR, eventosR, presencasR, inscricoesR, avaliacoesR] = await Promise.all([
    admin.from('clientes').select('id, nome, nome_preferido').in('id', ids),
    admin
      .from('agenda_eventos')
      .select('id, cliente_id, tipo, data, hora_inicio, duracao_min, estado, pt_id, servico_id')
      .in('cliente_id', ids)
      .in('tipo', ['Treino', 'Avaliação'])
      .gte('data', somarDiasIso(hoje, -DIAS_TREINOS_ANTES))
      .lte('data', somarDiasIso(hoje, DIAS_TREINOS_DEPOIS))
      .limit(10000),
    admin
      .from('presencas')
      .select('id, cliente_id, data, estado')
      .in('cliente_id', ids)
      .gte('data', somarDiasIso(hoje, -DIAS_PRESENCAS))
      .limit(20000),
    admin
      .from('aulas_inscricoes')
      .select('id, cliente_id, aula_id, estado, aula:aulas!inner(data, servico_id)')
      .in('cliente_id', ids)
      .gte('aula.data', somarDiasIso(hoje, -DIAS_PRESENCAS))
      .limit(20000),
    admin
      .from('avaliacoes')
      .select(
        'id, cliente_id, data, peso_kg, altura_cm, massa_gorda_pct, massa_gorda_kg, massa_magra_kg, massa_muscular_kg, gordura_visceral, hidratacao_pct, metabolismo_kcal, idade_metabolica, imc, proxima_reavaliacao'
      )
      .in('cliente_id', ids)
      .limit(5000),
  ])
  for (const r of [clientesR, eventosR, presencasR, inscricoesR, avaliacoesR]) if (r.error) throw new Error(r.error.message)

  const agrupar = <T extends { cliente_id: string }>(xs: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of xs) m.set(x.cliente_id, [...(m.get(x.cliente_id) ?? []), x])
    return m
  }
  const clientes = new Map((clientesR.data ?? []).map((c) => [c.id as string, c]))
  const eventos = agrupar((eventosR.data ?? []) as EventoGestao[])
  const presencas = agrupar((presencasR.data ?? []) as PresencaGestao[])
  const inscricoes = agrupar(
    ((inscricoesR.data ?? []) as unknown as { id: string; cliente_id: string; aula_id: string; estado: string; aula: { data: string; servico_id: number } }[]).map(
      (i): InscricaoGestao => ({ id: i.id, cliente_id: i.cliente_id, aula_id: i.aula_id, estado: i.estado, data: i.aula.data, servico_id: i.aula.servico_id })
    )
  )
  const avaliacoes = agrupar((avaliacoesR.data ?? []) as AvaliacaoGestao[])

  const mudaram: { conta: Conta; dados: DadosConta; hash: string }[] = []
  const iguais: Conta[] = []
  for (const conta of devidas) {
    const cli = clientes.get(conta.cliente_id)
    const dados = montarDadosConta({
      contaId: conta.conta_id,
      nome: cli ? primeiroNomeExibicao(cli.nome as string, cli.nome_preferido as string | null) : 'Cliente',
      eventos: eventos.get(conta.cliente_id) ?? [],
      presencas: presencas.get(conta.cliente_id) ?? [],
      inscricoes: inscricoes.get(conta.cliente_id) ?? [],
      avaliacoes: avaliacoes.get(conta.cliente_id) ?? [],
      aulasNaApp,
      servicos,
      nomes,
    })
    // As inscrições dependem das aulas que estão na app: entram na impressão.
    const hash = impressao(dados)
    if (hash !== conta.hash_dados || afetados.has(conta.conta_id)) mudaram.push({ conta, dados, hash })
    else iguais.push(conta)
  }

  const agoraIso = agora.toISOString()
  for (const lote of chunks(mudaram, 15)) {
    const { error } = await app.rpc('sync_substituir_dados', { p_token: token, p_dados: lote.map((l) => l.dados) })
    if (error) {
      rel.erros.push(`dados: ${error.message}`)
      continue
    }
    await Promise.all(
      lote.map((l) => admin.from('app_clientes_contas').update({ hash_dados: l.hash, sincronizado_em: agoraIso }).eq('cliente_id', l.conta.cliente_id))
    )
    rel.contasCopiadas += lote.length
  }
  if (iguais.length) {
    await admin.from('app_clientes_contas').update({ sincronizado_em: agoraIso }).in('cliente_id', iguais.map((c) => c.cliente_id))
  }
  rel.contasVistas = devidas.length

  // 6) Estado das contas na app (ativada? último acesso?).
  const { data: estadoContas } = await app.rpc('sync_contas', { p_token: token })
  for (const e of (estadoContas ?? []) as { id: string; ativada_em: string | null; ultimo_acesso: string | null }[]) {
    const c = porConta.get(e.id)
    if (!c) continue
    await admin.from('app_clientes_contas').update({ ativada_em: e.ativada_em, ultimo_acesso: e.ultimo_acesso }).eq('cliente_id', c.cliente_id)
  }
  return rel
}

async function tratarPedido(admin: SupabaseClient, p: PedidoApp, conta: Conta, agora: Date): Promise<RespostaPedido | null> {
  if (p.tipo === 'inscrever_aula') {
    const { error } = await admin.rpc('inscrever_em_aula_app', { p_aula: p.alvo, p_cliente: conta.cliente_id })
    if (!error) return { id: p.id, estado: 'aceite', resposta: RESPOSTAS.inscrito }
    const msg = erroDeRegra(error)
    return msg ? { id: p.id, estado: 'recusado', resposta: msg } : null
  }
  if (p.tipo === 'cancelar_aula') {
    const { error } = await admin.rpc('cancelar_inscricao_app', { p_aula: p.alvo, p_cliente: conta.cliente_id })
    if (!error) return { id: p.id, estado: 'aceite', resposta: RESPOSTAS.cancelado }
    const msg = erroDeRegra(error)
    return msg ? { id: p.id, estado: 'recusado', resposta: msg } : null
  }
  if (p.tipo === 'desmarcar_treino') {
    const { data, error } = await admin
      .from('agenda_eventos')
      .select('id, cliente_id, tipo, estado, data, hora_inicio')
      .eq('id', p.alvo)
      .maybeSingle()
    if (error) return null
    const recusa = avaliarDesmarcacao((data as EventoParaDesmarcar | null) ?? null, conta.cliente_id, agora)
    return recusa ? { id: p.id, estado: 'recusado', resposta: recusa } : { id: p.id, estado: 'em_analise', resposta: RESPOSTAS.emAnalise }
  }
  return { id: p.id, estado: 'recusado', resposta: 'Pedido inválido.' }
}
