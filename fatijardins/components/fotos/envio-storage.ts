/** Mensagens dos envios de ficheiros (fotos e assinaturas) para o Storage, no browser. */

export const SEM_REDE =
  "Sem ligação ao servidor. Verifique a rede (dados móveis ou Wi-Fi) e tente de novo."

/** O browser diz que está sem rede (no campo é frequente). */
export function semRede(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export type ErroStorage = { name?: string; message: string; status?: number; statusCode?: string }

/** Traduz um erro do upload para o Storage. destino: "este trabalho", "esta visita"… */
export function mensagemErroEnvio(erro: ErroStorage, destino: string): string {
  if (semRede() || erro.name === "StorageUnknownError") return SEM_REDE
  const codigo = String(erro.statusCode ?? erro.status ?? "")
  if (codigo === "413") return "O ficheiro é demasiado grande para enviar."
  if (codigo === "401" || codigo === "403" || /row-level security/i.test(erro.message)) {
    return `Não tem permissão para enviar ficheiros para ${destino}. Se a sessão terminou, volte a entrar.`
  }
  if (codigo === "415" || /mime/i.test(erro.message)) return "Este tipo de ficheiro não é aceite."
  return "Não foi possível enviar o ficheiro. Tente de novo."
}

/**
 * Identificador aleatório (UUID v4) para o nome dos ficheiros. O
 * crypto.randomUUID só existe em https; a alternativa cobre outros casos.
 */
export function novoUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
