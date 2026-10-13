import { z } from "zod"

import { dataObrigatoria, idObrigatorio, textoOpcional, uuidOpcional } from "./comum"

// ---------------------------------------------------------------------
// Picagem (chamada pelo widget, não por um formulário)
// ---------------------------------------------------------------------

const coordenada = (min: number, max: number) => z.number().min(min).max(max).nullable()

export const esquemaLocalizacao = z
  .object({
    latitude: coordenada(-90, 90),
    longitude: coordenada(-180, 180),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), "Localização incompleta.")
export type DadosLocalizacao = z.output<typeof esquemaLocalizacao>

export const esquemaPicarEntrada = z
  .object({
    /** null = sem trabalho (armazém, deslocação…). */
    trabalhoId: z.uuid("Trabalho inválido.").nullable(),
    latitude: coordenada(-90, 90),
    longitude: coordenada(-180, 180),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), "Localização incompleta.")
export type DadosPicarEntrada = z.output<typeof esquemaPicarEntrada>

// ---------------------------------------------------------------------
// Períodos introduzidos ou corrigidos pelo gerente
// ---------------------------------------------------------------------

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export const esquemaPeriodo = z
  .object({
    colaboradorId: idObrigatorio,
    data: dataObrigatoria(),
    entrada: z.string().regex(HORA, "Indique a hora de entrada."),
    /** Vazio só ao editar um período ainda aberto (a pessoa continua a trabalhar). */
    saida: z.string().refine((v) => v === "" || HORA.test(v), "Indique uma hora válida."),
    /** O período está aberto (só ao editar uma picagem em curso). */
    aberto: z.boolean(),
    trabalhoId: uuidOpcional,
    notas: textoOpcional(500),
  })
  .refine((v) => v.saida !== "" || v.aberto, { path: ["saida"], message: "Indique a hora de saída." })
  .refine((v) => v.saida === "" || v.saida > v.entrada, {
    path: ["saida"],
    message: "A saída tem de ser depois da entrada.",
  })
export type CamposPeriodo = z.input<typeof esquemaPeriodo>
export type DadosPeriodo = z.output<typeof esquemaPeriodo>
