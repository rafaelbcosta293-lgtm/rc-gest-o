import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularResumoMes, diasDoMesISO, juntarDiasFerias, type ResumoMes } from './assiduidade'
import { equipaAssiduidade, type ConfigAssiduidade, type MembroEquipa } from './equipaAssiduidade'
import { getEstudios } from './estudios'

export type EstadoFecho = 'Rascunho' | 'Submetido' | 'Aprovado'

export type LinhaHorasMes = {
  id: string
  nome: string
  estudioNome: string
  estudioSlug: string
  tipoContrato: ConfigAssiduidade['tipo_contrato']
  resumo: ResumoMes
  estado: EstadoFecho
  submetidoEm: string | null
  aprovadoEm: string | null
}

// As horas de toda a equipa (dos estúdios todos) num mês: horas feitas,
// horas do mês, extra, dias de férias e o estado da submissão de cada
// um. É o resumo que a Administração passa ao contabilista.
//
// As contas são sempre feitas a partir dos registos como estão agora —
// um mês submetido fica fechado ao instrutor, por isso só mudam se a
// gestão corrigir alguma coisa depois (e convém ver o valor corrigido).
export async function carregarHorasDoMes(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  hoje: string
): Promise<LinhaHorasMes[]> {
  const estudios = await getEstudios(supabase)
  const equipas = await Promise.all(estudios.map((e) => equipaAssiduidade(supabase, e.id)))
  // Quem dá treinos nos dois estúdios aparece nas duas equipas: conta uma vez.
  const pessoas = new Map<string, MembroEquipa>()
  for (const equipa of equipas) for (const m of equipa) if (!pessoas.has(m.id)) pessoas.set(m.id, m)
  const ids = [...pessoas.keys()]
  if (ids.length === 0) return []

  const dias = diasDoMesISO(ano, mes)
  const [{ data: registos, error: erroRegistos }, { data: ferias, error: erroFerias }, { data: fechos, error: erroFechos }] = await Promise.all([
    supabase.from('registos_horario').select('perfil_id, data, horas, ferias').in('perfil_id', ids).gte('data', dias[0]).lte('data', dias[dias.length - 1]),
    supabase.from('pedidos_ferias').select('perfil_id, dias').in('perfil_id', ids).eq('estado', 'Aprovado').eq('ano', ano),
    supabase.from('fechos_horario').select('perfil_id, estado, submetido_em, aprovado_em').in('perfil_id', ids).eq('ano', ano).eq('mes', mes),
  ])
  const erro = erroRegistos ?? erroFerias ?? erroFechos
  if (erro) throw new Error(erro.message)

  const estudioPorId = new Map(estudios.map((e) => [e.id, e]))
  // Num mês que ainda vai a meio, "sem registo" só conta até hoje.
  const ateDia = hoje < dias[dias.length - 1] ? hoje : undefined

  return [...pessoas.values()]
    .map((m) => {
      const estudio = estudioPorId.get(m.config.estudio_id) ?? estudios[0]
      const dele = (registos ?? []).filter((r) => r.perfil_id === m.id)
      const fecho = (fechos ?? []).find((f) => f.perfil_id === m.id)
      return {
        id: m.id,
        nome: m.nome,
        estudioNome: estudio?.nome ?? '—',
        estudioSlug: estudio?.slug ?? '',
        tipoContrato: m.config.tipo_contrato,
        resumo: calcularResumoMes({
          ano,
          mes,
          slug: estudio?.slug ?? '',
          horasDiarias: m.config.horas_diarias,
          registos: dele.map((r) => ({ data: r.data, horas: Number(r.horas) })),
          diasFerias: juntarDiasFerias(
            (ferias ?? []).filter((f) => f.perfil_id === m.id),
            dele
          ),
          ateDia,
        }),
        estado: (fecho?.estado ?? 'Rascunho') as EstadoFecho,
        submetidoEm: fecho?.submetido_em ?? null,
        aprovadoEm: fecho?.aprovado_em ?? null,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
}

// Quantos meses estão submetidos à espera de aprovação — o número que
// aparece no menu da Administração. Nunca parte a página.
export async function contarFechosPorAprovar(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from('fechos_horario').select('id', { count: 'exact', head: true }).eq('estado', 'Submetido')
  return error ? 0 : (count ?? 0)
}
