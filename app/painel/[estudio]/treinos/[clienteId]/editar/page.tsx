import Link from '@/components/LinkRapido'
import { carregarServicos } from '@/lib/data/servicos'
import { carregarInscricoes, servicosLigados } from '@/lib/data/clientesServicos'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { atualizarCliente } from '../../actions'
import ClienteForm from '../../ClienteForm'
import { ArrowLeft } from 'lucide-react'

const MODULOS_ORIGEM = ['clientes', 'treinos']

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ error?: string; voltar?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const { error, voltar: voltarParam } = await searchParams
  const voltar = MODULOS_ORIGEM.includes(voltarParam ?? '') ? voltarParam! : 'treinos'

  const supabase = await createClient()
  const [estudio, { data: cliente }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
  ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  const [pts, servicos, inscricoes] = await Promise.all([
    getEquipaDoEstudio(supabase, estudio.id, cliente.pt_principal_id),
    carregarServicos(supabase, { soAtivos: true }),
    carregarInscricoes(supabase, clienteId),
  ])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/${voltar}/${clienteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {cliente.nome}
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Editar ficha
      </h1>

      <ClienteForm
        estudioSlug={slug}
        estudioId={estudio.id}
        cliente={cliente}
        pts={pts}
        servicos={servicos.map((s) => ({ id: s.id, nome: s.nome }))}
        servicosLigados={servicosLigados(cliente.cliente_pt !== false, inscricoes)}
        action={atualizarCliente}
        error={error}
        voltar={voltar}
      />
    </div>
  )
}
