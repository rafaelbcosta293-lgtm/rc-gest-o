// "Serviço" de uma despesa: um dos serviços ou "Estúdio (partilhada)"
// — uma despesa partilhada (renda, luz, software…) não é de nenhum
// serviço em especial e reparte-se entre todos nas contas.
export default function CampoServico({
  servicos,
  valorInicial,
  className,
  rotuloCls = 'flex flex-col gap-1 text-xs font-medium text-muted',
}: {
  servicos: { id: number; nome: string }[]
  valorInicial: number | null | undefined
  className: string
  rotuloCls?: string
}) {
  return (
    <label className={rotuloCls}>
      Serviço
      <select name="servico_id" defaultValue={valorInicial ?? ''} className={className}>
        <option value="">Estúdio (partilhada)</option>
        {servicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
