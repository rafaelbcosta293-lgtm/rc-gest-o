import { eDataValida, limitarData, somarDiasData } from "@/lib/datas"
import { compararOrdem, type EstadoTrabalho, type TipoTrabalho } from "@/lib/trabalhos"

export type Vista = "semana" | "dia"

/** Trabalho tal como a agenda o mostra (já com cliente e local). */
export type TrabalhoAgenda = {
  id: string
  titulo: string
  data: string
  /** "08:30" ou null. */
  hora: string | null
  duracaoMin: number | null
  equipaId: string | null
  ordem: number
  estado: EstadoTrabalho
  tipo: TipoTrabalho
  serie: boolean
  cliente: string
  local: string
}

/** Uma linha (semana) ou coluna (dia) da agenda: uma equipa ou "Por atribuir" (id null). */
export type LinhaEquipa = {
  id: string | null
  nome: string
  cor: string | null
  /** Pode criar, mover e reordenar trabalhos desta equipa (o chefe só nas que chefia). */
  editavel: boolean
}

export type DiaAgenda = {
  data: string
  feriado: string | null
  hoje: boolean
  fimDeSemana: boolean
}

export type Ausente = { nome: string; motivo: string }

/** Ausências por equipa e dia (chave de chaveCelula). */
export type Ausentes = Record<string, Ausente[]>

export const SEM_EQUIPA = "sem-equipa"

export function chaveCelula(equipaId: string | null, data: string) {
  return `${equipaId ?? SEM_EQUIPA}::${data}`
}

/** Ordem de passagem; depois a hora (sem hora no fim) e o título. */
export const compararTrabalhos: (a: TrabalhoAgenda, b: TrabalhoAgenda) => number = compararOrdem

/** Os trabalhos concluídos ou cancelados ficam onde estão. */
export function podeMover(trabalho: TrabalhoAgenda) {
  return trabalho.estado === "agendado" || trabalho.estado === "em_curso"
}

// ---------------------------------------------------------------------
// Endereço da agenda: ?vista=semana|dia&data=aaaa-mm-dd&equipa=<uuid>|todas
// ---------------------------------------------------------------------

export type ParametrosAgenda = { vista: Vista; data: string; equipa: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function eUuid(valor: string | null | undefined): valor is string {
  return !!valor && UUID.test(valor)
}

/** Lê os parâmetros do endereço (valores inválidos voltam ao valor por omissão). */
export function lerParametrosAgenda(
  obter: (nome: string) => string | undefined,
  hoje: string
): ParametrosAgenda {
  const data = obter("data")
  const equipa = obter("equipa")
  return {
    vista: obter("vista") === "dia" ? "dia" : "semana",
    data: eDataValida(data) ? data : hoje,
    equipa: eUuid(equipa) ? equipa.toLowerCase() : "todas",
  }
}

export function urlAgenda({ vista, data, equipa }: ParametrosAgenda, hoje: string) {
  const parametros = new URLSearchParams()
  if (vista === "dia") parametros.set("vista", "dia")
  if (data !== hoje) parametros.set("data", data)
  if (equipa !== "todas") parametros.set("equipa", equipa)
  return parametros.size ? `/agenda?${parametros}` : "/agenda"
}

/** Endereço para criar um trabalho já com a data e a equipa. */
export function urlNovoTrabalho(data: string | null, equipaId: string | null) {
  const parametros = new URLSearchParams()
  if (data) parametros.set("data", data)
  if (equipaId) parametros.set("equipa", equipaId)
  return parametros.size ? `/trabalhos/novo?${parametros}` : "/trabalhos/novo"
}

export function passoAgenda(vista: Vista) {
  return vista === "semana" ? 7 : 1
}

/** Dia/semana anterior ou seguinte, sem sair das datas aceites (no limite fica igual). */
export function deslocar(parametros: ParametrosAgenda, sentido: 1 | -1): ParametrosAgenda {
  const data = somarDiasData(parametros.data, sentido * passoAgenda(parametros.vista))
  return { ...parametros, data: limitarData(data) }
}
