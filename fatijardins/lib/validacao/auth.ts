import { z } from "zod"

import { emailObrigatorio } from "./comum"

export const esquemaLogin = z.object({
  email: emailObrigatorio,
  palavraPasse: z.string().min(1, "Indique a palavra-passe."),
})
export type CamposLogin = z.input<typeof esquemaLogin>

export const esquemaRecuperar = z.object({
  email: emailObrigatorio,
})
export type CamposRecuperar = z.input<typeof esquemaRecuperar>

export const esquemaNovaPalavraPasse = z
  .object({
    palavraPasse: z
      .string()
      .min(8, "A palavra-passe tem de ter pelo menos 8 caracteres.")
      .max(72, "A palavra-passe é demasiado longa."),
    confirmar: z.string(),
  })
  .refine((v) => v.palavraPasse === v.confirmar, {
    path: ["confirmar"],
    message: "As palavras-passe não coincidem.",
  })
export type CamposNovaPalavraPasse = z.input<typeof esquemaNovaPalavraPasse>

/**
 * Só aceita caminhos internos (ex. "/clientes") para evitar redirecionar
 * para sites externos através de ?seguinte=. Usa o mesmo parser de URL do
 * browser, que ignora tabulações e mudanças de linha ("/\t/site.com").
 */
export function caminhoSeguro(valor: string | null | undefined, alternativa = "/"): string {
  if (!valor || !valor.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(valor)) {
    return alternativa
  }
  try {
    const base = "http://fatijardins.invalid"
    const url = new URL(valor, base)
    const caminho = url.pathname + url.search + url.hash
    // A normalização pode criar um endereço de outro site ("/..//site.com"
    // passa a "//site.com"): verificar também o resultado final.
    if (
      url.origin !== base ||
      !caminho.startsWith("/") ||
      caminho.startsWith("//") ||
      new URL(caminho, base).origin !== base
    ) {
      return alternativa
    }
    return caminho
  } catch {
    return alternativa
  }
}
