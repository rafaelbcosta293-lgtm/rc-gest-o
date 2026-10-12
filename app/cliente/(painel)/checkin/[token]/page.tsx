import Link from 'next/link'
import { getSessaoCliente } from '@/lib/data/sessaoCliente'
import { estudioDoTokenCheckin, registarPresencaCheckin } from '@/lib/data/checkin'

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { cliente } = await getSessaoCliente()
  if (!cliente) return null

  const estudio = await estudioDoTokenCheckin(token)

  if (!estudio) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl">⚠️</span>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Código inválido</h1>
        <p className="text-sm text-zinc-500">Este código não corresponde a nenhum estúdio.</p>
        <Link href="/cliente" className="mt-2 text-sm font-medium text-zinc-950 underline dark:text-zinc-50">
          Voltar ao início
        </Link>
      </div>
    )
  }

  if (estudio.id !== cliente.estudio_id) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl">🚫</span>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Não é o teu estúdio</h1>
        <p className="text-sm text-zinc-500">Este código é de {estudio.nome}.</p>
        <Link href="/cliente" className="mt-2 text-sm font-medium text-zinc-950 underline dark:text-zinc-50">
          Voltar ao início
        </Link>
      </div>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)
  await registarPresencaCheckin(cliente.id, hoje)

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="text-5xl">✅</span>
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Presença registada</h1>
      <p className="text-sm text-zinc-500">
        {estudio.nome} · {new Date(`${hoje}T00:00:00`).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'long',
        })}
      </p>
      <Link href="/cliente" className="mt-2 text-sm font-medium text-zinc-950 underline dark:text-zinc-50">
        Voltar ao início
      </Link>
    </div>
  )
}
