// Que dados faltam na ficha de um cliente — para o filtro "Dados
// incompletos" da lista de clientes.

export type CampoFicha =
  | 'telefone'
  | 'email'
  | 'nif'
  | 'nascimento'
  | 'genero'
  | 'morada'
  | 'frequencia'
  | 'instrutor'
  | 'inicio'
  | 'objetivo'

export const CAMPOS_FICHA: { campo: CampoFicha; rotulo: string }[] = [
  { campo: 'telefone', rotulo: 'Telefone' },
  { campo: 'email', rotulo: 'Email' },
  { campo: 'nif', rotulo: 'NIF' },
  { campo: 'nascimento', rotulo: 'Data de nascimento' },
  { campo: 'genero', rotulo: 'Género' },
  { campo: 'morada', rotulo: 'Morada' },
  { campo: 'frequencia', rotulo: 'Treinos por semana' },
  { campo: 'instrutor', rotulo: 'Instrutor principal' },
  { campo: 'inicio', rotulo: 'Data de início' },
  { campo: 'objetivo', rotulo: 'Objetivo' },
]

export function ehCampoFicha(v: string | undefined): v is CampoFicha {
  return !!v && CAMPOS_FICHA.some((c) => c.campo === v)
}

export type DadosFicha = {
  telefone: string | null
  email: string | null
  nif: string | null
  nascimento: string | null
  genero: string | null
  morada: string | null
  codigo_postal: string | null
  cidade: string | null
  frequencia_semanal: number | null
  pt_principal_id: string | null
  inicio_contrato: string | null
  objetivo: string | null
}

const vazio = (v: string | null | undefined) => !v || !v.trim()

// Os campos em falta, pela ordem de CAMPOS_FICHA. A morada conta como
// incompleta se faltar a rua, o código postal ou a localidade.
export function camposEmFalta(c: DadosFicha): CampoFicha[] {
  const falta: Record<CampoFicha, boolean> = {
    telefone: vazio(c.telefone),
    email: vazio(c.email),
    nif: vazio(c.nif),
    nascimento: !c.nascimento,
    genero: !c.genero,
    morada: vazio(c.morada) || vazio(c.codigo_postal) || vazio(c.cidade),
    frequencia: c.frequencia_semanal == null,
    instrutor: !c.pt_principal_id,
    inicio: !c.inicio_contrato,
    objetivo: vazio(c.objetivo),
  }
  return CAMPOS_FICHA.map((c) => c.campo).filter((k) => falta[k])
}

export const rotuloCampo = (campo: CampoFicha) => CAMPOS_FICHA.find((c) => c.campo === campo)?.rotulo ?? campo
