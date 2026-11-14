import type { TipoOperacao } from '@/lib/supabase/database.types'

// Checklist oficial de Abertura e Fecho do RC Private Fitness Studio —
// as mesmas secções, itens e textos do formulário que a equipa
// preenchia (Google Forms), pela mesma ordem.
export const CHECKLIST_PADRAO: Record<TipoOperacao, { secao: string; itens: string[] }[]> = {
  Abertura: [
    {
      secao: 'Ambiente',
      itens: [
        'Iluminação geral ligada e regulada na intensidade correta',
        'Climatização ligada e ajustada',
        'Virar ambientador da receção',
        'Pulverizar ambientador da receção',
        'Ligar música',
        'Tablet e telemóvel ligados',
      ],
    },
    {
      secao: 'Higiene e zonas comuns',
      itens: [
        'Receção limpa, balcão organizado e computador ligado',
        'Balneários inspecionados (chão, espelhos e lavatórios impecáveis)',
        'Consumíveis repostos (papel higiénico, toalhetes, sabonete e gel de banho)',
        'Stock de toalhas limpas abastecido',
        'Máquina de café limpa e água reposta',
      ],
    },
    {
      secao: 'Sala de treino / Equipamentos',
      itens: [
        'Todo o material (halteres, discos, kettlebells, colchões) alinhado por peso/tamanho',
        'Inspeção visual de segurança feita (cabos, polias e manípulos operacionais)',
        'Ecrãs de cardio e superfícies principais limpas e sem marcas',
        'Estações de clientes higienizadas (mesas de apoio e chão)',
      ],
    },
    {
      secao: 'Administrativo',
      itens: [
        'Agenda do dia revista (PTs agendados, avaliações e visitas)',
        'Fundo de caixa verificado e terminal de pagamentos ligado',
      ],
    },
  ],
  Fecho: [
    {
      secao: 'Sala de treino e equipamentos',
      itens: [
        'Todos os equipamentos e acessórios organizados nos respetivos suportes',
        'Acessórios e estofos higienizados com produto desinfetante',
        'Equipamentos eletrónicos de treino desligados (Máq. Cardio, Subwoofer, Água fresca)',
      ],
    },
    {
      secao: 'Balneários e higiene',
      itens: [
        'Balneários limpos (chão limpo, lavatório limpo e lixos recolhidos, caso tenham lixo)',
        'Verificação de objetos perdidos por clientes (se houver, registar nas notas)',
        'Chuveiros e torneiras completamente fechados (sem fugas)',
      ],
    },
    {
      secao: 'Zonas comuns e receção',
      itens: [
        'Balcão da receção arrumado (fichas/folhas arrumadas e arquivadas e computador desligado)',
        'Máquina de café limpa, esvaziada e desligada',
        'Fecho de caixa (caixa conferida e valores guardados de acordo com o protocolo interno)',
        'Verificar se o aspirador está conectado',
      ],
    },
    {
      secao: 'Encerramento e segurança',
      itens: [
        'Climatização (Ar Condicionado) desligada em todas as salas',
        'Sistema de som e ecrãs totalmente desligados',
        'Iluminação interna completamente apagada (exceto luzes de emergência/presença acordadas)',
        'Todas as janelas fechadas e portas interiores trancadas',
        'Porta principal trancada e alarme geral do estúdio ativado',
      ],
    },
  ],
}

export const TEXTO_CHECKLIST: Record<TipoOperacao, { intro: string; nota: string }> = {
  Abertura: {
    intro:
      'Garante a consistência, a organização e o padrão de excelência Premium do RC Private Fitness Studio antes da chegada do primeiro cliente. Verifica e assinala cada tarefa com rigor, à medida que a executas.',
    nota: 'Esta checklist é obrigatória e é feita em paralelo com o registo da hora e a assinatura na Folha de Ponto Mensal, na receção. Obrigado pelo teu profissionalismo e bom turno!',
  },
  Fecho: {
    intro:
      'Assegura que o estúdio fica perfeitamente higienizado, organizado e seguro no final do dia, para a equipa do turno seguinte o encontrar pronto a operar no nível VIP habitual.',
    nota: 'Valida todos os pontos de segurança crítica (luzes, AC, portaria e alarme) antes de dares a checklist por concluída. Não te esqueças de registar a hora real de saída e de assinar a Folha de Ponto Mensal, na receção. Bom descanso!',
  },
}

export const AJUDA_OCORRENCIAS =
  'Espaço para reportar avarias, falta de stock de consumíveis ou feedback relevante de clientes.'

// Compara itens sem ligar a maiúsculas, acentos, pontuação final ou
// espaços a mais — para não duplicar um item que já lá está escrito de
// forma ligeiramente diferente.
export function chaveItem(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Itens do padrão que ainda não existem no modelo (por tipo).
export function itensEmFalta(
  tipo: TipoOperacao,
  existentes: { item: string }[]
): { secao: string; item: string }[] {
  const jaExiste = new Set(existentes.map((e) => chaveItem(e.item)))
  return CHECKLIST_PADRAO[tipo].flatMap((s) =>
    s.itens.filter((item) => !jaExiste.has(chaveItem(item))).map((item) => ({ secao: s.secao, item }))
  )
}
