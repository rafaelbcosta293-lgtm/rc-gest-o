import Link from "next/link"
import { SearchXIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"

export default function NaoEncontrado() {
  return (
    <EstadoVazio
      paginaInteira
      icone={SearchXIcon}
      titulo="Página não encontrada"
      descricao="O registo pode ter sido apagado ou não tem acesso a ele."
      acao={
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      }
    />
  )
}
