"use client"

import { useState } from "react"
import { useForm, type Control, type FieldValues, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  CopyIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  TriangleAlertIcon,
  UserRoundPlusIcon,
  WandSparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import {
  esquemaCriarAcesso,
  esquemaReporPalavraPasse,
  type CamposCriarAcesso,
  type CamposReporPalavraPasse,
} from "@/lib/validacao/equipa"
import { ConfirmarAcao } from "../../_componentes/confirmar-acao"
import { gerarPalavraPasse } from "../../_componentes/gerar-palavra-passe"
import { criarAcesso, reporPalavraPasse, retirarAcesso } from "../../acoes"

type Props = {
  colaboradorId: string
  nome: string
  ativo: boolean
  /** Email de acesso (conta) ou null se não tem conta. */
  emailAcesso: string | null
  /** Email da ficha, para pré-preencher a criação do acesso. */
  emailFicha: string
  /** O gerente a ver a sua própria ficha. */
  eProprio: boolean
  /** A chave secreta do Supabase não está configurada no servidor. */
  semChaveAdmin: boolean
}

type Credenciais = { email: string; palavraPasse: string }

/** Secção "Acesso à app" da ficha (só gerente). */
export function AcessoApp({
  colaboradorId,
  nome,
  ativo,
  emailAcesso,
  emailFicha,
  eProprio,
  semChaveAdmin,
}: Props) {
  // Os diálogos ficam sempre montados: depois de criar o acesso a página
  // atualiza-se (passa a "tem conta") e o diálogo continua a mostrar a
  // palavra-passe para o gerente a comunicar.
  const [criarAberto, setCriarAberto] = useState(false)
  const [reporAberto, setReporAberto] = useState(false)
  const temConta = emailAcesso !== null

  return (
    <div className="grid gap-4">
      {semChaveAdmin && (
        <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          Para criar acessos, configure SUPABASE_SECRET_KEY nas variáveis de ambiente.
        </p>
      )}

      {temConta ? (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ShieldCheckIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Tem acesso à app</p>
              <p className="text-sm break-all text-muted-foreground">Entra com {emailAcesso}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" size="lg" onClick={() => setReporAberto(true)} disabled={semChaveAdmin}>
              <KeyRoundIcon />
              Repor palavra-passe
            </Button>
            {eProprio ? (
              <p className="text-sm text-muted-foreground sm:self-center">
                Não pode retirar o seu próprio acesso.
              </p>
            ) : (
              <ConfirmarAcao
                gatilho={
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={semChaveAdmin}
                    className="text-destructive hover:text-destructive"
                  >
                    <ShieldOffIcon />
                    Retirar acesso
                  </Button>
                }
                titulo="Retirar o acesso à app?"
                descricao={`A conta ${emailAcesso} é apagada e ${nome} deixa de conseguir entrar. A ficha e o histórico mantêm-se; pode criar um acesso novo mais tarde.`}
                confirmar="Retirar acesso"
                acao={() => retirarAcesso(colaboradorId)}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShieldOffIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Sem acesso à app</p>
              <p className="text-sm text-muted-foreground">
                {ativo
                  ? "Crie uma conta para esta pessoa poder entrar com email e palavra-passe."
                  : "O colaborador está inativo. Ative-o antes de lhe criar acesso."}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            className="w-full sm:w-fit"
            onClick={() => setCriarAberto(true)}
            disabled={!ativo || semChaveAdmin}
          >
            <UserRoundPlusIcon />
            Criar acesso
          </Button>
        </>
      )}

      <DialogoCriarAcesso
        aberto={criarAberto}
        aoMudar={setCriarAberto}
        colaboradorId={colaboradorId}
        nome={nome}
        emailFicha={emailFicha}
      />
      {temConta && (
        <DialogoReporPalavraPasse
          aberto={reporAberto}
          aoMudar={setReporAberto}
          colaboradorId={colaboradorId}
          nome={nome}
          email={emailAcesso}
        />
      )}
    </div>
  )
}

function DialogoCriarAcesso({
  aberto,
  aoMudar,
  colaboradorId,
  nome,
  emailFicha,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  colaboradorId: string
  nome: string
  emailFicha: string
}) {
  const [concluido, setConcluido] = useState<Credenciais | null>(null)
  const form = useForm<CamposCriarAcesso>({
    resolver: zodResolver(esquemaCriarAcesso),
    defaultValues: { colaboradorId, email: emailFicha, palavraPasse: "" },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, criarAcesso, {
    aoConcluir: () => {
      const { email, palavraPasse } = form.getValues()
      setConcluido({ email: email.trim().toLowerCase(), palavraPasse })
    },
  })

  // Formulário limpo e palavra-passe nova sempre que o diálogo abre.
  function preparar() {
    setConcluido(null)
    form.reset({ colaboradorId, email: emailFicha, palavraPasse: gerarPalavraPasse() })
  }

  function mudar(abrir: boolean) {
    if (!aGuardar) aoMudar(abrir)
  }

  return (
    <Dialog open={aberto} onOpenChange={mudar}>
      <DialogContent onOpenAutoFocus={preparar}>
        {concluido ? (
          <PainelCredenciais
            titulo="Acesso criado"
            nome={nome}
            credenciais={concluido}
            aoFechar={() => mudar(false)}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={submeter} className="grid gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>Criar acesso à app</DialogTitle>
                <DialogDescription>
                  {nome} vai entrar com este email e a palavra-passe temporária. Depois pode mudá-la
                  em Perfil.
                </DialogDescription>
              </DialogHeader>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de acesso</FormLabel>
                    <FormControl>
                      <Input type="email" inputMode="email" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CampoPalavraPasse control={form.control} name="palavraPasse" />
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => mudar(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={aGuardar}>
                  {aGuardar && <LoaderCircleIcon className="animate-spin" />}
                  Criar acesso
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DialogoReporPalavraPasse({
  aberto,
  aoMudar,
  colaboradorId,
  nome,
  email,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  colaboradorId: string
  nome: string
  email: string
}) {
  const [concluido, setConcluido] = useState<Credenciais | null>(null)
  const form = useForm<CamposReporPalavraPasse>({
    resolver: zodResolver(esquemaReporPalavraPasse),
    defaultValues: { colaboradorId, palavraPasse: "" },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, reporPalavraPasse, {
    aoConcluir: () => setConcluido({ email, palavraPasse: form.getValues("palavraPasse") }),
  })

  function preparar() {
    setConcluido(null)
    form.reset({ colaboradorId, palavraPasse: gerarPalavraPasse() })
  }

  function mudar(abrir: boolean) {
    if (!aGuardar) aoMudar(abrir)
  }

  return (
    <Dialog open={aberto} onOpenChange={mudar}>
      <DialogContent onOpenAutoFocus={preparar}>
        {concluido ? (
          <PainelCredenciais
            titulo="Palavra-passe reposta"
            nome={nome}
            credenciais={concluido}
            aoFechar={() => mudar(false)}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={submeter} className="grid gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>Repor palavra-passe</DialogTitle>
                <DialogDescription>
                  Defina uma palavra-passe temporária para {nome} ({email}). A anterior deixa de
                  funcionar.
                </DialogDescription>
              </DialogHeader>
              <CampoPalavraPasse control={form.control} name="palavraPasse" />
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => mudar(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={aGuardar}>
                  {aGuardar && <LoaderCircleIcon className="animate-spin" />}
                  Repor palavra-passe
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Campo da palavra-passe temporária (visível) com o botão "Gerar". */
function CampoPalavraPasse<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>
  name: Path<T>
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Palavra-passe temporária</FormLabel>
          <div className="flex gap-2">
            <FormControl>
              <Input
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono"
                {...field}
              />
            </FormControl>
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-10"
              onClick={() => field.onChange(gerarPalavraPasse())}
            >
              <WandSparklesIcon />
              Gerar
            </Button>
          </div>
          <FormDescription>Pelo menos 8 caracteres.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** Mostra o email e a palavra-passe para o gerente comunicar ao colaborador. */
function PainelCredenciais({
  titulo,
  nome,
  credenciais,
  aoFechar,
}: {
  titulo: string
  nome: string
  credenciais: Credenciais
  aoFechar: () => void
}) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        `Fatijardins\nEmail: ${credenciais.email}\nPalavra-passe: ${credenciais.palavraPasse}`
      )
      toast.success("Dados copiados.")
    } catch {
      toast.error("Não foi possível copiar. Anote os dados manualmente.")
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>
          Comunique estes dados a {nome}. Por segurança, a palavra-passe não volta a ser mostrada.
        </DialogDescription>
      </DialogHeader>
      <dl className="grid gap-3 rounded-lg border bg-muted/40 p-4">
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="font-medium break-all">{credenciais.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Palavra-passe</dt>
          <dd className="font-mono text-lg font-semibold break-all" data-testid="palavra-passe-temporaria">
            {credenciais.palavraPasse}
          </dd>
        </div>
      </dl>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={copiar}>
          <CopyIcon />
          Copiar
        </Button>
        <Button type="button" size="lg" onClick={aoFechar}>
          Concluído
        </Button>
      </DialogFooter>
    </div>
  )
}
