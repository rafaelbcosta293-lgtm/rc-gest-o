import Link from '@/components/LinkRapido'
import { MODULOS } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'

// De qualquer página de um cliente (treinos, avaliações, presenças,
// pagamentos) salta-se para as outras sem voltar à lista: uma fila de
// atalhos com a página atual assinalada. Só aparecem os módulos a que
// esta conta tem acesso.
const DESTINOS = [
  { id: 'clientes', nome: 'Ficha' },
  { id: 'treinos', nome: 'Treinos' },
  { id: 'avaliacoes', nome: 'Avaliações' },
  { id: 'presencas', nome: 'Presenças' },
  { id: 'pagamentos', nome: 'Pagamentos' },
] as const

export default async function AtalhosDoCliente({
  slug,
  clienteId,
  atual,
  className = 'mt-3',
}: {
  slug: string
  clienteId: string
  atual: (typeof DESTINOS)[number]['id']
  className?: string
}) {
  const sessao = await getSessaoAtual()
  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)
  const contaIndividual = !ehContaFixa(sessao.email)
  const visiveis = DESTINOS.filter((d) => {
    const m = MODULOS.find((x) => x.id === d.id)
    if (!m || !m.pronto) return false
    if (contaIndividual) return sessao.modulos.includes(m.id)
    return !m.restrito || (m.restrito === 'admin' ? ehAdmin : ehGestao)
  })
  if (visiveis.length <= 1) return null
  return (
    <nav aria-label="Outras páginas deste cliente" className={`barra desliza w-fit max-w-full ${className}`}>
      {visiveis.map((d) =>
        d.id === atual ? (
          <span key={d.id} aria-current="page" className="barra-item ativo">
            {d.nome}
          </span>
        ) : (
          <Link key={d.id} href={`/painel/${slug}/${d.id}/${clienteId}`} className="barra-item">
            {d.nome}
          </Link>
        )
      )}
    </nav>
  )
}
