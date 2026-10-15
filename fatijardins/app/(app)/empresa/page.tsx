import { Suspense } from "react"
import { FileTextIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { FormularioEmpresa } from "./formulario-empresa"

export const metadata = { title: "Dados da empresa" }

export default function PaginaEmpresa() {
  return (
    <div className="max-w-2xl">
      <CabecalhoPagina
        titulo="Dados da empresa"
        descricao="Nome, NIF, morada e contactos da Fatijardins."
        voltar={{ href: "/perfil", texto: "Perfil" }}
      />
      <Suspense fallback={<EsqueletoEmpresa />}>
        <DadosEmpresa />
      </Suspense>
    </div>
  )
}

async function DadosEmpresa() {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const { data: empresa, error } = await supabase.from("empresa").select("*").maybeSingle()
  if (error) throw new Error(`Erro ao ler os dados da empresa: ${error.message}`)
  if (!empresa) throw new Error("Os dados da empresa não existem na base de dados.")

  return (
    <>
      <div className="mb-6 flex gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
        <FileTextIcon className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          Estes dados aparecem no cabeçalho e no rodapé do <strong>PDF dos orçamentos</strong>. O PDF é gerado na
          hora em que se abre: o que alterar aqui aparece também nos orçamentos que já existem.
        </p>
      </div>
      {/* A chave volta a montar o formulário quando os dados mudam (depois de gravar). */}
      <FormularioEmpresa key={empresa.updated_at} empresa={empresa} />
    </>
  )
}

function EsqueletoEmpresa() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <Skeleton className="mb-6 h-20 w-full rounded-lg" />
      <div className="grid gap-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full md:h-10" />
          </div>
        ))}
        <Skeleton className="h-12 w-40" />
      </div>
    </div>
  )
}
