// "Hoje" para o negócio é sempre o dia em Portugal continental. O
// servidor corre em UTC: no horário de verão, entre a meia-noite e a
// uma da manhã de Lisboa ainda é "ontem" em UTC — um pagamento ou um
// fecho de caixa registado a essa hora ficava com a data errada.
// Função pura (sem base de dados), por isso serve tanto no servidor
// como em componentes do browser.
export function hojeEmLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(agora)
}
