import type { SupabaseClient } from '@supabase/supabase-js'

// Dias em que um estúdio está fechado (normalmente feriados): a Agenda
// não deixa marcar, mover, repetir nem reativar treinos para lá.

const dataPt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

// Os dias fechados de um estúdio entre duas datas (fim exclusivo):
// data → motivo. Nunca parte a página.
export async function carregarDiasFechados(
  supabase: SupabaseClient,
  estudioId: number,
  inicio: string,
  fimExclusivo: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('dias_fechados')
    .select('data, motivo')
    .eq('estudio_id', estudioId)
    .gte('data', inicio)
    .lt('data', fimExclusivo)
  if (error) return {}
  return Object.fromEntries((data ?? []).map((d) => [d.data as string, (d.motivo as string | null) ?? 'Estúdio fechado']))
}

// Das datas dadas, as que estão fechadas nesse estúdio (por ordem).
export async function datasFechadas(supabase: SupabaseClient, estudioId: number, datas: string[]): Promise<string[]> {
  const unicas = [...new Set(datas)].sort()
  if (unicas.length === 0) return []
  const { data, error } = await supabase.from('dias_fechados').select('data').eq('estudio_id', estudioId).in('data', unicas)
  if (error) return []
  return (data ?? []).map((d) => d.data as string).sort()
}

// A mensagem para quem tenta marcar num dia fechado.
export function mensagemDiaFechado(datas: string[]): string {
  if (datas.length === 0) return ''
  const lista = datas.map(dataPt)
  return datas.length === 1
    ? `O estúdio está fechado a ${lista[0]} — não se podem marcar treinos nesse dia.`
    : `O estúdio está fechado a ${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]} — não se podem marcar treinos nesses dias.`
}
