// Mapa de calor dia-da-semana × hora, em células simples (sem
// biblioteca de gráficos) — a intensidade da cor vem da proporção face
// ao valor máximo da grelha.
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Heatmap({
  grelha,
  horaInicio,
  cor = 'var(--accent)',
}: {
  grelha: number[][]
  horaInicio: number
  cor?: string
}) {
  const maximo = Math.max(1, ...grelha.flat())
  const nHoras = grelha[0]?.length ?? 0

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-8" />
            {Array.from({ length: nHoras }, (_, i) => (
              <th key={i} className="min-w-[1.5rem] text-[10px] font-normal text-muted">
                {horaInicio + i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grelha.map((linha, diaIdx) => (
            <tr key={diaIdx}>
              <td className="text-[10px] text-muted">{DIAS[diaIdx]}</td>
              {linha.map((valor, horaIdx) => (
                <td key={horaIdx}>
                  <div
                    title={`${valor}`}
                    className="h-6 w-6 rounded-sm"
                    style={{ background: cor, opacity: valor === 0 ? 0.06 : 0.15 + 0.85 * (valor / maximo) }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
