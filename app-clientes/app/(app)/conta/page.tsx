import { KeyRound, LogOut, Smartphone } from 'lucide-react'
import { Cartao, Seccao, TituloPagina } from '@/components/ui'
import { contaAtual } from '@/lib/dados'
import { sair } from '../../entrar/actions'

export const metadata = { title: 'A minha conta' }

export default async function ContaPage() {
  const conta = await contaAtual()
  return (
    <div>
      <TituloPagina titulo="A minha conta" />

      <Cartao className="mt-4 flex items-center gap-4 p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xl font-bold text-brand">
          {conta.nome.trim().charAt(0).toUpperCase() || 'C'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold">{conta.nome}</p>
          <p className="mt-0.5 text-sm text-muted">RC Private Fitness Studio · {conta.estudio_nome}</p>
        </div>
      </Cartao>

      <Seccao titulo="Dados de acesso">
        <Cartao className="divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-muted">Nº de cliente</span>
            <span className="font-mono font-semibold tracking-wide">{conta.numero}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-muted">Estúdio</span>
            <span className="font-semibold">{conta.estudio_nome}</span>
          </div>
        </Cartao>
        <p className="mt-2.5 px-1 text-sm leading-snug text-muted">O nº de cliente serve para entrar na app e para registar a presença no tablet à entrada do estúdio.</p>
      </Seccao>

      <Seccao titulo="Ajuda">
        <Cartao className="divide-y divide-border">
          <div className="flex gap-3.5 px-4 py-3.5">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.8} />
            <div>
              <p className="font-semibold">Mudar a password</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">Peça à equipa do estúdio um novo link por SMS e escolha outra password.</p>
            </div>
          </div>
          <div className="flex gap-3.5 px-4 py-3.5">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.8} />
            <div>
              <p className="font-semibold">Abrir como uma app</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">
                No menu do browser escolha «Adicionar ao ecrã principal». Fica com um ícone no telemóvel e abre em ecrã inteiro.
              </p>
            </div>
          </div>
        </Cartao>
      </Seccao>

      <form action={sair} className="mt-7">
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-surface text-[0.95rem] font-semibold text-red-700 ring-1 ring-border active:bg-soft">
          <LogOut className="h-[1.1rem] w-[1.1rem]" /> Terminar sessão
        </button>
      </form>
    </div>
  )
}
