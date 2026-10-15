import { formatarData, formatarHora } from "@/lib/formatar"
import { formatarDiaSemanaCurto } from "@/lib/datas"

/**
 * Visitas ao local do cliente para preparar um orçamento. As fotos ficam no
 * mesmo bucket privado das fotos dos trabalhos (BUCKET_FOTOS), na pasta
 * visitas/<visita_id>/ (a RLS do Storage depende deste formato).
 */

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"

/** Caminho no Storage: visitas/<visita_id>/<ficheiro>. */
export function caminhoFicheiroVisita(visitaId: string, ficheiro: string) {
  return `visitas/${visitaId}/${ficheiro}`
}

/** A foto tem de estar na pasta da própria visita, com nome <uuid>.jpg. */
export function eCaminhoFotoVisita(visitaId: string, caminho: string): boolean {
  return new RegExp(`^visitas/${visitaId}/${UUID}\\.jpg$`).test(caminho)
}

/** Ex.: "sábado, 17/10/2026, 15:00" (sem hora: só o dia). */
export function formatarQuandoVisita(data: string, hora: string | null): string {
  const dia = `${formatarDiaSemanaCurto(data)}, ${formatarData(data)}`
  return hora ? `${dia}, ${formatarHora(hora)}` : dia
}

/** Ex.: "Margarida Coelho — Quintinha". */
export function nomeSitioVisita(cliente: string | null | undefined, local: string | null | undefined): string {
  return [cliente, local].filter(Boolean).join(" — ")
}
