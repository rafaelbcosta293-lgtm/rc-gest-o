import { z } from "zod"

import {
  codigoPostalOpcional,
  emailOpcional,
  nifOpcional,
  numeroOpcional,
  telefoneOpcional,
  textoObrigatorio,
  textoOpcional,
} from "./comum"

/**
 * Os nomes dos campos são os das colunas da base de dados, para os erros
 * devolvidos pelo servidor caírem no campo certo do formulário.
 */

export const esquemaCliente = z.object({
  nome: textoObrigatorio("Indique o nome do cliente."),
  nif: nifOpcional,
  pessoa_contacto: textoOpcional(200),
  telemovel: telefoneOpcional,
  telefone: telefoneOpcional,
  email: emailOpcional,
  morada: textoOpcional(300),
  codigo_postal: codigoPostalOpcional,
  localidade: textoOpcional(100),
  notas: textoOpcional(),
  ativo: z.boolean(),
})
export type CamposCliente = z.input<typeof esquemaCliente>
export type DadosCliente = z.output<typeof esquemaCliente>

export const MENSAGEM_COORDENADAS = "Indique a latitude e a longitude, ou deixe as duas em branco."

export const esquemaLocal = z
  .object({
    nome: textoObrigatorio("Indique o nome do local (ex.: Moradia).", 120),
    morada: textoObrigatorio("Indique a morada do local.", 300),
    codigo_postal: codigoPostalOpcional,
    localidade: textoOpcional(100),
    latitude: numeroOpcional({ min: -90, max: 90 }),
    longitude: numeroOpcional({ min: -180, max: 180 }),
    area_m2: numeroOpcional({ min: 0, max: 99_999_999 }),
    notas: textoOpcional(),
    ativo: z.boolean(),
  })
  .superRefine((local, ctx) => {
    // Coordenadas: as duas ou nenhuma (a base de dados também o exige).
    if ((local.latitude === null) !== (local.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: [local.latitude === null ? "latitude" : "longitude"],
        message: MENSAGEM_COORDENADAS,
      })
    }
  })
export type CamposLocal = z.input<typeof esquemaLocal>
export type DadosLocal = z.output<typeof esquemaLocal>
