import { FileDown } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'
import { listarArquivo, type TipoDeArquivo } from '@/lib/data/arquivoRegistos'
import { arquivarPdfDoMes } from '@/app/painel/admin/arquivoActions'

// A secção "Arquivo mensal em PDF" das páginas da Administração:
// descarregar o documento de um mês (feito na hora), guardá-lo já no
// arquivo e ver os meses que lá estão.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
const diaMes = (iso: string) => {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date(iso))
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}
const ROTA_PDF = '/painel/admin/horas/pdf'

export default async function ArquivoMensal({
  tipo,
  mesISO,
  voltar,
  descricao,
  mensagem,
  erro,
}: {
  tipo: TipoDeArquivo
  // O mês que a página está a mostrar ("AAAA-MM").
  mesISO: string
  // O endereço desta página (para voltar depois de guardar).
  voltar: string
  descricao: string
  mensagem?: string
  erro?: string
}) {
  const arquivo = await listarArquivo(tipo)
  const noArquivo = arquivo.find((a) => a.mes === mesISO)
  const botao = 'rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-brand/[.08]'
  return (
    <section id="arquivo" className="mt-8 scroll-mt-24 rounded-xl border border-border-subtle bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Arquivo mensal em PDF</h2>
      <p className="mt-1 text-sm text-muted">
        {descricao} O PDF do mês anterior é guardado sozinho nos dias 1, 6 e 12 de cada mês (para apanhar o que ainda for registado ou corrigido).
      </p>
      {mensagem === 'guardado' && <p className="mt-2 rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">PDF guardado no arquivo.</p>}
      {erro && <p className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* <a> simples (e não Link): é um ficheiro para descarregar, não uma página. */}
        <a
          href={`${ROTA_PDF}?tipo=${tipo}&mes=${mesISO}`}
          download
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong"
        >
          <FileDown className="h-3.5 w-3.5" /> Descarregar PDF de {nomeMes(mesISO)}
        </a>
        <form action={arquivarPdfDoMes}>
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="mes" value={mesISO} />
          <input type="hidden" name="voltar" value={voltar} />
          <SubmitButton pendingText="A guardar…" className={botao}>
            {noArquivo ? `Refazer ${nomeMes(mesISO)} no arquivo` : `Guardar já ${nomeMes(mesISO)} no arquivo`}
          </SubmitButton>
        </form>
        {noArquivo && <span className="text-xs text-muted">guardado a {diaMes(noArquivo.guardadoEm)}</span>}
      </div>
      {arquivo.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Ainda não há meses guardados.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {arquivo.map((a) => (
            <li key={a.mes}>
              <a
                href={`${ROTA_PDF}?tipo=${tipo}&mes=${a.mes}&arquivo=1`}
                download
                className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2 text-sm hover:border-border-strong hover:bg-foreground/[.05]"
              >
                <span className="flex items-center gap-2 font-semibold text-foreground first-letter:uppercase">
                  <FileDown className="h-4 w-4 text-muted" /> {nomeMes(a.mes)}
                </span>
                <span className="text-xs text-muted">
                  guardado a {diaMes(a.guardadoEm)} · {Math.max(1, Math.round(a.bytes / 1024))} KB
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
