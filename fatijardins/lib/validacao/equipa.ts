import { z } from "zod"

import { PERFIS } from "@/lib/perfis"
import { TIPOS_AUSENCIA } from "@/lib/rotulos"
import {
  dataObrigatoria,
  emailObrigatorio,
  emailOpcional,
  idObrigatorio,
  numeroOpcional,
  telefoneOpcional,
  textoObrigatorio,
  textoOpcional,
  uuidOpcional,
} from "./comum"

// ---------------------------------------------------------------------
// Colaboradores
// ---------------------------------------------------------------------

export const esquemaColaborador = z.object({
  nome: textoObrigatorio("Indique o nome.", 120),
  funcao: textoOpcional(100),
  perfil: z.enum(PERFIS, { error: "Escolha o perfil." }),
  telemovel: telefoneOpcional,
  email: emailOpcional,
  equipaId: uuidOpcional,
  custoHora: numeroOpcional({ min: 0, max: 9999 }),
  ativo: z.boolean(),
})
export type CamposColaborador = z.input<typeof esquemaColaborador>
export type DadosColaborador = z.output<typeof esquemaColaborador>

// ---------------------------------------------------------------------
// Acesso à app (contas em auth.users)
// ---------------------------------------------------------------------

const palavraPasseTemporaria = z
  .string()
  .min(8, "A palavra-passe tem de ter pelo menos 8 caracteres.")
  .max(72, "A palavra-passe é demasiado longa.")

export const esquemaCriarAcesso = z.object({
  colaboradorId: idObrigatorio,
  email: emailObrigatorio,
  palavraPasse: palavraPasseTemporaria,
})
export type CamposCriarAcesso = z.input<typeof esquemaCriarAcesso>

export const esquemaReporPalavraPasse = z.object({
  colaboradorId: idObrigatorio,
  palavraPasse: palavraPasseTemporaria,
})
export type CamposReporPalavraPasse = z.input<typeof esquemaReporPalavraPasse>

// ---------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------

export const esquemaAusencia = z
  .object({
    colaboradorId: idObrigatorio,
    tipo: z.enum(TIPOS_AUSENCIA, { error: "Escolha o tipo de ausência." }),
    dataInicio: dataObrigatoria("Indique a data de início."),
    dataFim: dataObrigatoria("Indique a data de fim."),
    notas: textoOpcional(500),
  })
  .refine((v) => v.dataFim >= v.dataInicio, {
    path: ["dataFim"],
    message: "A data de fim não pode ser anterior à data de início.",
  })
export type CamposAusencia = z.input<typeof esquemaAusencia>
export type DadosAusencia = z.output<typeof esquemaAusencia>

// ---------------------------------------------------------------------
// Equipas
// ---------------------------------------------------------------------

/** Cores sugeridas para as equipas (usadas também no calendário). */
export const CORES_EQUIPA = [
  { valor: "#15803d", nome: "Verde" },
  { valor: "#b45309", nome: "Terra" },
  { valor: "#1d4ed8", nome: "Azul" },
  { valor: "#7c3aed", nome: "Roxo" },
  { valor: "#be123c", nome: "Vermelho" },
  { valor: "#0f766e", nome: "Verde-azulado" },
] as const

export const esquemaEquipa = z.object({
  nome: textoObrigatorio("Indique o nome da equipa.", 80),
  cor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma cor válida.")
    .transform((cor) => cor.toLowerCase()),
  chefeId: uuidOpcional,
  ativa: z.boolean(),
  notas: textoOpcional(1000),
})
export type CamposEquipa = z.input<typeof esquemaEquipa>
export type DadosEquipa = z.output<typeof esquemaEquipa>
