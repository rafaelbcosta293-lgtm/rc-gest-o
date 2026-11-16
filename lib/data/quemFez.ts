import { ehContaFixa } from './acessos'
import { getSessaoAtual } from './sessao'
import { pessoasParaTarefas, type PessoaTarefas } from './tarefas'

// "Quem fez": nos estúdios trabalha-se numa conta partilhada (o tablet),
// por isso a conta não diz quem resolveu um alerta, recebeu um pagamento
// ou fez o fecho de caixa. Pede-se o nome da pessoa — como ao concluir
// uma tarefa — e é esse nome que fica no registo.

// A equipa (para escolher o nome) e, numa conta pessoal, quem é — aí não
// se pergunta nada: fica em nome dela.
export async function dadosQuemFez(): Promise<{ pessoas: PessoaTarefas[]; euId: string | null }> {
  const [sessao, pessoas] = await Promise.all([getSessaoAtual(), pessoasParaTarefas()])
  const euId = sessao.userId && !ehContaFixa(sessao.email) && pessoas.some((p) => p.id === sessao.userId) ? sessao.userId : null
  return { pessoas, euId }
}

// O nome escolhido no formulário, se for mesmo alguém da equipa.
export async function lerQuemFez(formData: FormData, campo = 'quem_fez'): Promise<string | null> {
  const id = formData.get(campo)
  if (typeof id !== 'string' || !id) return null
  return (await pessoasParaTarefas()).some((p) => p.id === id) ? id : null
}
