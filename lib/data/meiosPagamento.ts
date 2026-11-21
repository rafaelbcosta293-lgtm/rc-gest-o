// Meios de pagamento de cada estúdio mostrados no tablet de check-in a quem
// tem a mensalidade por regularizar (config: pagamento_<campo>_<slug>, lidos
// pela função dados_pagamento_estudio na base de dados).
export const CAMPOS_PAGAMENTO = [
  { campo: 'mbway', rotulo: 'MB Way (nº de telemóvel)', exemplo: '912 345 678' },
  { campo: 'iban', rotulo: 'IBAN (transferência)', exemplo: 'PT50 0000 0000 0000 0000 0000 0' },
  { campo: 'titular', rotulo: 'Titular da conta', exemplo: 'RC Private Fitness Studio, Lda' },
  { campo: 'nota', rotulo: 'Nota (opcional)', exemplo: 'Também pode pagar por Multibanco ou numerário na próxima visita.' },
] as const
