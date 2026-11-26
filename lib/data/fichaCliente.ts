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
  inicio_contrato: string | null
  objetivo: string | null
}

const vazio = (v: string | null | undefined) => !v || !v.trim()

// A rua com o número ("Rua da Sobreira, 14") — a morada guarda-se em
// campos separados (rua, nº, código postal, cidade, país).
export function ruaComNumero(rua: string | null | undefined, numero: string | null | undefined): string | null {
  const partes = [rua?.trim(), numero?.trim()].filter((p): p is string => !!p)
  return partes.length > 0 ? partes.join(', ') : null
}

// A morada inteira numa linha, para mostrar na ficha.
export function moradaCompleta(c: {
  morada?: string | null
  morada_numero?: string | null
  codigo_postal?: string | null
  cidade?: string | null
  concelho?: string | null
  pais?: string | null
}): string | null {
  // O concelho só aparece quando não é o próprio nome da terra.
  const cidade = c.cidade?.trim()
  const concelho = c.concelho?.trim()
  const terra = cidade && concelho && concelho !== cidade ? `${cidade} (${concelho})` : cidade
  const localidade = [c.codigo_postal?.trim(), terra].filter((p): p is string => !!p).join(' ')
  const partes = [ruaComNumero(c.morada, c.morada_numero), localidade, c.pais?.trim()].filter((p): p is string => !!p)
  return partes.length > 0 ? partes.join(' · ') : null
}

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
    inicio: !c.inicio_contrato,
    objetivo: vazio(c.objetivo),
  }
  return CAMPOS_FICHA.map((c) => c.campo).filter((k) => falta[k])
}

export const rotuloCampo = (campo: CampoFicha) => CAMPOS_FICHA.find((c) => c.campo === campo)?.rotulo ?? campo
