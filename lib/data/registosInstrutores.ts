import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { ehContaFixa } from './acessos'
import { calcularResumoMes, diasDoMesISO, HORAS_DIARIAS_OMISSAO, juntarDiasFerias, type ResumoMes } from './assiduidade'

// Os registos de cada instrutor num mês — horas, férias, ausências e
// escalas — para o documento mensal (PDF) que a administração guarda
// fora da aplicação.
//
// Entra toda a gente que tem alguma coisa registada no mês, mesmo quem
// já saiu ou foi eliminado da equipa: é um arquivo, não a equipa atual.

export type EstadoFecho = 'Rascunho' | 'Submetido' | 'Aprovado'
export type Situacao = 'ativo' | 'inativo' | 'eliminado'

export type DiaRegistado = {
  data: string
  entrada1: string | null
  saida1: string | null
  entrada2: string | null
  saida2: string | null
  horas: number
  ferias: boolean
  nota: string | null
}

export type AusenciaRegistada = { inicio: string; fim: string; tipo: string; nota: string | null }

export type RegistosInstrutor = {
  id: string
  nome: string
  situacao: Situacao
  estudioNome: string
  estudioSlug: string
  tipoContrato: 'contrato' | 'recibos_verdes'
  resumo: ResumoMes
  estado: EstadoFecho
  submetidoEm: string | null
  aprovadoEm: string | null
  // Só os dias em que há registo de horas (ou de férias).
  dias: DiaRegistado[]
  ausencias: AusenciaRegistada[]
  // Quantos dias do mês (de calendário) apanham as ausências.
  diasDeAusencia: number
  // Horas de escala por dia e no mês (cada turno da escala é meia hora).
  escalaPorDia: Record<string, number>
  horasEscala: number
}

export type RegistosDoMes = {
  ano: number
  mes: number
  // Com o mês ainda a decorrer, até que dia vão as contas.
  ateDia?: string
  instrutores: RegistosInstrutor[]
}

const HORAS_POR_TURNO_DE_ESCALA = 0.5

type Perfil = { id: string; nome: string; ativo: boolean; eliminado_em: string | null }
type Estudio = { id: number; nome: string; slug: string }
type Config = { perfil_id: string; estudio_id: number; horas_diarias: number | string; tipo_contrato: 'contrato' | 'recibos_verdes' }
type LinhaRegisto = {
  perfil_id: string
  data: string
  entrada_1: string | null
  saida_1: string | null
  entrada_2: string | null
  saida_2: string | null
  horas: number | string
  ferias: boolean | null
  nota: string | null
}
type LinhaAusencia = { pt_id: string; inicio: string; fim: string; tipo: string; nota: string | null }
type LinhaEscala = { pt_id: string; data: string; estudio_id: number }

export type DadosDoMes = {
  ano: number
  mes: number
  hoje: string
  estudios: Estudio[]
  perfis: Perfil[]
  // Ids das contas do negócio (dono, geral, estúdios) — não são instrutores.
  contasFixas: Set<string>
  ligacoes: { perfil_id: string; estudio_id: number }[]
  configs: Config[]
  registos: LinhaRegisto[]
  pedidosFerias: { perfil_id: string; dias: unknown }[]
  fechos: { perfil_id: string; estado: string; submetido_em: string | null; aprovado_em: string | null }[]
  ausencias: LinhaAusencia[]
  escalas: LinhaEscala[]
}

const hora = (t: string | null) => (t ? t.slice(0, 5) : null)

// Arruma o que veio da base de dados por instrutor. Função pura, para
// se poder testar sem base de dados.
export function montarRegistosDoMes(d: DadosDoMes): RegistosDoMes {
  const dias = diasDoMesISO(d.ano, d.mes)
  const primeiro = dias[0]
  const ultimo = dias[dias.length - 1]
  const doMes = (data: string) => data >= primeiro && data <= ultimo
  const ateDia = d.hoje < ultimo ? d.hoje : undefined
  const estudioPorId = new Map(d.estudios.map((e) => [e.id, e]))
  const configPorPerfil = new Map(d.configs.map((c) => [c.perfil_id, c]))

  const instrutores = d.perfis
    .filter((p) => !d.contasFixas.has(p.id))
    .map((p): (RegistosInstrutor & { temRegistos: boolean }) | null => {
      const registos = d.registos.filter((r) => r.perfil_id === p.id && doMes(r.data))
      const pedidos = d.pedidosFerias.filter((f) => f.perfil_id === p.id)
      const ausencias = d.ausencias.filter((a) => a.pt_id === p.id && a.inicio <= ultimo && a.fim >= primeiro)
      const escalas = d.escalas.filter((e) => e.pt_id === p.id && doMes(e.data))
      const fecho = d.fechos.find((f) => f.perfil_id === p.id)
      const diasFerias = juntarDiasFerias(pedidos, registos).filter(doMes)
      const temRegistos = registos.length > 0 || diasFerias.length > 0 || ausencias.length > 0 || escalas.length > 0 || !!fecho
      const naEquipa = p.ativo && !p.eliminado_em
      if (!naEquipa && !temRegistos) return null

      // O estúdio: o da configuração; senão o primeiro a que está ligado;
      // senão aquele onde tem mais turnos de escala no mês.
      const config = configPorPerfil.get(p.id)
      const porEstudio = new Map<number, number>()
      for (const e of escalas) porEstudio.set(e.estudio_id, (porEstudio.get(e.estudio_id) ?? 0) + 1)
      const estudioDaEscala = [...porEstudio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      const estudioId = config?.estudio_id ?? d.ligacoes.find((l) => l.perfil_id === p.id)?.estudio_id ?? estudioDaEscala
      const estudio = (estudioId != null ? estudioPorId.get(estudioId) : undefined) ?? d.estudios[0]

      const escalaPorDia: Record<string, number> = {}
      for (const e of escalas) escalaPorDia[e.data] = (escalaPorDia[e.data] ?? 0) + HORAS_POR_TURNO_DE_ESCALA

      const diasAusentes = new Set<string>()
      for (const a of ausencias) for (const dia of dias) if (dia >= a.inicio && dia <= a.fim) diasAusentes.add(dia)

      return {
        id: p.id,
        nome: p.nome.trim(),
        situacao: p.eliminado_em ? 'eliminado' : p.ativo ? 'ativo' : 'inativo',
        estudioNome: estudio?.nome ?? '—',
        estudioSlug: estudio?.slug ?? '',
        tipoContrato: config?.tipo_contrato ?? 'contrato',
        resumo: calcularResumoMes({
          ano: d.ano,
          mes: d.mes,
          slug: estudio?.slug ?? '',
          horasDiarias: config ? Number(config.horas_diarias) : HORAS_DIARIAS_OMISSAO,
          registos: registos.map((r) => ({ data: r.data, horas: Number(r.horas) })),
          diasFerias,
          ateDia,
        }),
        estado: (fecho?.estado ?? 'Rascunho') as EstadoFecho,
        submetidoEm: fecho?.submetido_em ?? null,
        aprovadoEm: fecho?.aprovado_em ?? null,
        dias: registos
          .map((r) => ({
            data: r.data,
            entrada1: hora(r.entrada_1),
            saida1: hora(r.saida_1),
            entrada2: hora(r.entrada_2),
            saida2: hora(r.saida_2),
            horas: Number(r.horas),
            ferias: !!r.ferias,
            nota: r.nota?.trim() || null,
          }))
          .sort((a, b) => a.data.localeCompare(b.data)),
        ausencias: ausencias
          .map((a) => ({ inicio: a.inicio, fim: a.fim, tipo: a.tipo, nota: a.nota?.trim() || null }))
          .sort((a, b) => a.inicio.localeCompare(b.inicio)),
        diasDeAusencia: diasAusentes.size,
        escalaPorDia,
        horasEscala: escalas.length * HORAS_POR_TURNO_DE_ESCALA,
        temRegistos,
      }
    })
    .filter((i): i is RegistosInstrutor & { temRegistos: boolean } => i !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map((i): RegistosInstrutor => {
      const copia: Partial<typeof i> = { ...i }
      delete copia.temRegistos
      return copia as RegistosInstrutor
    })

  return { ano: d.ano, mes: d.mes, ateDia, instrutores }
}

// Lê tudo de um mês. Precisa do cliente de administração: o documento
// inclui quem já não está na equipa, e é gerado também sem ninguém com
// sessão aberta (tarefa mensal automática).
export async function carregarRegistosDoMes(admin: SupabaseClient, ano: number, mes: number, hoje: string): Promise<RegistosDoMes> {
  const dias = diasDoMesISO(ano, mes)
  const primeiro = dias[0]
  const ultimo = dias[dias.length - 1]
  const [estudios, perfis, contas, ligacoes, configs, registos, pedidosFerias, fechos, ausencias, escalas] = await Promise.all([
    admin.from('estudios').select('id, nome, slug').order('id'),
    admin.from('perfis').select('id, nome, ativo, eliminado_em'),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('perfis_estudios').select('perfil_id, estudio_id').order('estudio_id'),
    admin.from('config_assiduidade').select('perfil_id, estudio_id, horas_diarias, tipo_contrato'),
    todasAsLinhas<LinhaRegisto>((de, ate) =>
      admin
        .from('registos_horario')
        .select('perfil_id, data, entrada_1, saida_1, entrada_2, saida_2, horas, ferias, nota')
        .gte('data', primeiro)
        .lte('data', ultimo)
        .order('id')
        .range(de, ate)
    ),
    admin.from('pedidos_ferias').select('perfil_id, dias').eq('estado', 'Aprovado').eq('ano', ano),
    admin.from('fechos_horario').select('perfil_id, estado, submetido_em, aprovado_em').eq('ano', ano).eq('mes', mes),
    admin.from('ausencias').select('pt_id, inicio, fim, tipo, nota').lte('inicio', ultimo).gte('fim', primeiro),
    todasAsLinhas<LinhaEscala>((de, ate) =>
      admin.from('escalas').select('pt_id, data, estudio_id').gte('data', primeiro).lte('data', ultimo).order('id').range(de, ate)
    ),
  ])
  const erro =
    estudios.error ?? perfis.error ?? contas.error ?? ligacoes.error ?? configs.error ?? registos.error ?? pedidosFerias.error ?? fechos.error ?? ausencias.error ?? escalas.error
  if (erro) throw new Error(erro.message)

  return montarRegistosDoMes({
    ano,
    mes,
    hoje,
    estudios: (estudios.data ?? []) as Estudio[],
    perfis: (perfis.data ?? []) as Perfil[],
    contasFixas: new Set(contas.data.users.filter((u) => ehContaFixa(u.email ?? null)).map((u) => u.id)),
    ligacoes: (ligacoes.data ?? []) as { perfil_id: string; estudio_id: number }[],
    configs: (configs.data ?? []) as Config[],
    registos: registos.data,
    pedidosFerias: (pedidosFerias.data ?? []) as { perfil_id: string; dias: unknown }[],
    fechos: (fechos.data ?? []) as DadosDoMes['fechos'],
    ausencias: (ausencias.data ?? []) as LinhaAusencia[],
    escalas: escalas.data,
  })
}

// O mês anterior ao de uma data ("AAAA-MM-DD" → { ano, mes }).
export function mesAnterior(hoje: string): { ano: number; mes: number } {
  const ano = Number(hoje.slice(0, 4))
  const mes = Number(hoje.slice(5, 7))
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
}

export const chaveDoMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`

// Onde fica o PDF de um mês no arquivo (Vercel Blob, privado).
export const PASTA_ARQUIVO = 'registos-instrutores/'
export const caminhoNoArquivo = (ano: number, mes: number) => `${PASTA_ARQUIVO}${chaveDoMes(ano, mes)}.pdf`
export const nomeDoFicheiro = (ano: number, mes: number) => `registos-instrutores-${chaveDoMes(ano, mes)}.pdf`
