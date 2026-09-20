export type Categoria = {
  id: number
  parte: 'A' | 'B'
  nome: string
  nota: string
  ex: string[]
}

export const CATEGORIAS: Categoria[] = [
  { id: 1, parte: 'A', nome: 'Membros Inferiores (Geral)', nota: 'Cadeia inferior, bilateral ou unilateral', ex: [
    'Agachamento Back / Front Squat (Barra / Smith)', 'Leg Press 45º / Horizontal', 'Goblet Squat (Halter / Kettlebell)',
    'Passadas / Walk Lunges', 'Step-Up na Box / Banco', 'Peso Morto / Deadlift Convencional',
    'Cadeira Extensora', 'Agachamento Búlgaro', 'Cossack Squat', 'Agachamento Sissi' ] },
  { id: 2, parte: 'A', nome: 'Parte Anterior das Pernas (Quadríceps)', nota: 'Extensão de joelho, vetor vertical', ex: [
    'Cadeira Extensora (Bilateral / Unilateral)', 'Agachamento Hack na Smith Machine',
    'Leg Press com pés em posição baixa', 'Agachamento Frontal (Front Squat)', 'Agachamento Sissi (Livre / Smith)',
    'Step-Down Controlado na Box', 'Extensão de Joelho com Caneleira / Elástico', 'Agachamento com Bola Suíça na Parede' ] },
  { id: 3, parte: 'A', nome: 'Parte Posterior das Pernas (Isquiotibiais)', nota: 'Flexão de joelho e hip hinge', ex: [
    'Peso Morto Romeno (RDL com Barra / Halteres)', 'Stiff (Barra / Halteres)', 'Cadeira Flexora (Bilateral / Unilateral)',
    'Flexão de Joelhos na Bola Suíça / TRX / Sliders', 'Good Morning (Barra no Rack)',
    'Single-Leg RDL (Halter / Kettlebell)', 'Kickstand RDL (B-Stance)' ] },
  { id: 4, parte: 'A', nome: 'Glúteos (Máximo, Médio e Mínimo)', nota: 'Extensão de anca, abdução e rotação externa', ex: [
    'Hip Thrust (Barra / Smith / Unilateral)', 'Glute Bridge (Chão / Banco / Bola Suíça)',
    'Coice de Glúteo / Glute Kickback (Polia / Caneleiras)', 'Máquina Abdutora Sentada', 'Abdução de Anca na Polia Baixa',
    'Clamshell (Ostra) com Elástico / Miniband', 'Agachamento Búlgaro (com inclinação de tronco)',
    'Lunge Curvado / Curtsy Lunge', 'Step-Up Alto na Box' ] },
  { id: 5, parte: 'A', nome: 'Adutores', nota: 'Face interna da coxa e estabilização pélvica', ex: [
    'Máquina Adutora Sentada', 'Adutor Copenhaga no Banco (Copenhagen Plank)', 'Adução de Anca na Polia Baixa',
    'Agachamento Sumô (Barra / Smith / Kettlebell)', 'Leg Press com pés afastados (Sumô)', 'Cossack Squat' ] },
  { id: 6, parte: 'A', nome: 'Gémeos / Flexores do Tornozelo', nota: 'Solear e gastrocnémio', ex: [
    'Elevação de Calcanhares na Smith Machine (com Step)', 'Elevação de Calcanhares no Leg Press',
    'Elevação de Calcanhares Unilateral em pé com Halter', 'Elevação de Calcanhares no Step com Peso Corporal' ] },
  { id: 7, parte: 'A', nome: 'Membros Superiores (Geral)', nota: 'Cintura escapular e braços', ex: [
    'Supino Plano / Inclinado (Barra / Halteres / Smith)', 'Press Militar / Press de Ombros',
    'Elevações na Barra Fixa / Puxadas', 'Remada Curvada / Remada Unilateral',
    'Biceps Curl com Barra / Halteres', 'Extensão de Tríceps na Polia / Fundos' ] },
  { id: 8, parte: 'A', nome: 'Parte Anterior do Tronco (Peitoral)', nota: 'Empurrar horizontal e inclinado', ex: [
    'Supino Plano (Barra / Halteres / Smith)', 'Supino Inclinado (Barra / Halteres / Smith)',
    'Aberturas / Flyes Planos e Inclinados', 'Crossover na Polia (Alta / Média / Baixa)',
    'Flexões de Braços / Push-Ups (Chão / Banco / TRX / Bosu)', 'Chest Press na Polia Dupla' ] },
  { id: 9, parte: 'A', nome: 'Parte Posterior do Tronco (Costas)', nota: 'Puxada vertical, horizontal e depressão escapular', ex: [
    'Elevações na Barra Fixa (Pull-ups / Chin-ups)', 'Puxada Alta na Polia Dupla',
    'Remada Curvada (Barra / Halteres / Kettlebells)', 'Remada Unilateral ("Serrote") no Banco',
    'Remada T-Bar (Landmine)', 'Remada Invertida no TRX', 'Lat Pullover na Polia Alta / Banco', 'Remada Sentada com Cabo' ] },
  { id: 10, parte: 'A', nome: 'Ombros / Deltoides', nota: 'Deltoide anterior, lateral e posterior', ex: [
    'Press Militar com Barra', 'Press de Ombros com Halteres / Kettlebells', 'Press Arnold',
    'Elevações Laterais (Halteres / Polia / Elástico)', 'Elevações Frontais (Barra / Disco / Polia)',
    'Voos Posteriores / Reverse Flyes (Halteres / Polia)', 'Face Pull na Polia Alta com Corda', 'Remada Alta (Upright Row)' ] },
  { id: 11, parte: 'A', nome: 'Braços — Bíceps e Antebraço', nota: 'Flexores do cotovelo e preensão', ex: [
    'Biceps Curl com Barra / Halteres', 'Biceps Curl Banco Inclinado',
    'Hammer Curl / Bíceps Martelo (Halteres / Kettlebells / Corda)', 'Biceps Curl Concentrado', 'Zottman Curl',
    'Biceps Curl no TRX / Polia Alta', 'Flexão / Extensão de Pulsos com Barra', 'Plate Pinch Carry (Pega de Dedos)' ] },
  { id: 12, parte: 'A', nome: 'Braços — Tríceps', nota: 'Extensores do cotovelo', ex: [
    'Extensão de Tríceps na Polia (Corda / Barra Reta / Barra V)', 'Tríceps Testa / Skullcrusher (Barra / Halteres)',
    'Press Francês à Cabeça (Halter / Polia)', 'Supino com Pegada Fechada',
    'Fundos em Barras Paralelas', 'Fundos no Banco (Bench Dips)', 'Extensão de Tríceps no TRX',
    'Coice de Tríceps (Kickback) com Halter' ] },
  { id: 13, parte: 'A', nome: 'Abdominal (Parede Abdominal Direta)', nota: 'Flexão de tronco e de anca, reto abdominal e oblíquos', ex: [
    'Crunch Tradicional na Bola Suíça', 'Crunch Invertido na Bola Suíça / TRX',
    'Elevação de Pernas / Joelhos Suspenso na Barra', 'Elevação de Pernas em Banco Inclinado',
    'Abdominal "Canivete"', 'Russian Twist (Disco / Kettlebell / Bola Suíça)',
    'Mountain Climbers (Chão / Sliders / Bosu)' ] },
  { id: 14, parte: 'A', nome: 'Core (Estabilização Global)', nota: 'Anti-extensão, anti-rotação e anti-inclinação', ex: [
    'Prancha Frontal (Chão / Bosu / Bola Suíça)', 'Prancha Lateral (Chão / Bosu / TRX)',
    'Rollout de Abdominais (Bola Suíça / TRX / Sliders)', 'Pallof Press na Polia / Elástico (Ajoelhado / Em pé)',
    "Farmer's Carry / Suitcase Carry / Overhead Carry", 'Woodchopper na Polia (Alta-Baixa / Baixa-Alta)',
    'Dead Bug / Bird-Dog (Chão / Bosu / Bola Suíça)', 'Extensão Lombar / Hiperextensão na Bola Suíça' ] },
  { id: 15, parte: 'B', nome: 'Força Máxima / Carga Elevada', nota: 'Multiarticulares estruturais', ex: [
    'Agachamento Back Squat com Barra', 'Supino Plano com Barra', 'Peso Morto Convencional / Sumô',
    'Press Militar em pé com Barra', 'Leg Press 45º com Carga', 'Hip Thrust com Barra Olímpica' ] },
  { id: 16, parte: 'B', nome: 'Força Explosiva e Potência', nota: 'Taxa de produção de força (RFD)', ex: [
    'Wallball Shots', 'Slam Ball Overhead / Rotational Slams', 'Kettlebell Snatch / Clean & Press',
    'Push Press com Barra / Kettlebells', 'Lançamento de Peito com Bola Medicinal (Chest Pass)',
    'Flexões Pliométricas / com Palma' ] },
  { id: 17, parte: 'B', nome: 'Pliométricos e Agilidade', nota: 'Saltos, reatividade e desaceleração', ex: [
    'Box Jumps (Salto para Box)', 'Agachamento com Salto (Jump Squat) no Trampolim / Chão',
    'Step-Downs com Salto Controlado', 'Saltos Laterais no Step / Bosu', 'Saltos Contínuos no Trampolim',
    'Burpees com Salto para Box' ] },
  { id: 18, parte: 'B', nome: 'Unilaterais / Correção de Assimetrias', nota: 'Equilíbrio de força e estabilidade articular', ex: [
    'Agachamento Búlgaro', 'Step-Up no Banco / Box', 'RDL Unilateral (Single-Leg RDL)',
    'Remada Unilateral ("Serrote")', 'Press de Ombros Unilateral com Halter', 'Hip Thrust Unilateral',
    'Leg Press Unilateral', 'Extensão / Flexão Unilateral na Polia' ] },
  { id: 19, parte: 'B', nome: 'Condicionamento Cardiorrespiratório e HIIT', nota: 'Estímulos metabólicos de alta densidade', ex: [
    'Sprints na Air Bike', 'Séries de Tiro no Remo Ergométrico', 'Passadeira Inclinada / Sprints',
    'Saco de Boxe (Combinações Jab-Directo-Cruzado)', 'Sprints e Cadência Elevada na Bicicleta de Cycling',
    'Circuito Contínuo na Elíptica' ] },
  { id: 20, parte: 'B', nome: 'Estabilidade e Equilíbrio (Aparelhos Instáveis)', nota: 'Proprioceção e estabilizadores profundos', ex: [
    'Agachamento no Bosu (Lado bolha ou plano)', 'Agachamento com Bola Suíça na Parede',
    'Flexões sobre o Bosu / Bola Medicinal', 'Prancha na Bola Suíça / Bosu', 'Bird-Dog no Bosu',
    'Agachamento Búlgaro no TRX' ] },
  { id: 21, parte: 'B', nome: 'Calistenia / Peso Corporal', nota: 'O próprio corpo como resistência', ex: [
    'Elevações na Barra Fixa (Pull-ups / Chin-ups)', 'Flexões de Braços (Push-ups)',
    'Fundos em Barras Paralelas / Banco', 'Pistol Squats / Step-Downs', 'Pranchas e Variações de Core',
    'Inverted Rows no TRX' ] },
  { id: 22, parte: 'B', nome: 'Tração Metabólica / Grip Strength', nota: 'Resistência da pega e antebraços', ex: [
    "Farmer's Carry com Halter / Kettlebell Pesado", 'Plate Pinch Carry (segurar discos com os dedos)',
    'Suitcase Carry', 'Dead Hang na Barra de Elevações (Suspensão Isométrica)', 'Kettlebell Swings' ] },
  { id: 23, parte: 'B', nome: 'Reabilitação / Pré-Habilitação / Mobilidade', nota: 'Baixo impacto, saúde articular e aquecimento', ex: [
    'Clamshell com Elástico', 'Bird-Dog no Chão', 'Extensão Torácica na Bola Suíça',
    'Adutor Copenhaga (versão modificada)', 'Pallof Press leve com Elástico',
    'Caminhada no Trampolim (Baixo Impacto)' ] },
  { id: 24, parte: 'B', nome: 'Grupo / Circuito / Pump', nota: 'Treino em dupla ou pequenos grupos', ex: [
    'Agachamento Pump com Barra Pequena', 'Remada Curvada Pump', 'Clean & Press com Barra de Pump',
    'Lunge Estático com Barra de Pump', 'Biceps & Tríceps Pump com Barra / Discos Pequenos' ] },
  { id: 25, parte: 'B', nome: 'Discos Deslizantes (Sliders)', nota: 'Fricção e controlo excêntrico exigente', ex: [
    'Flexão de Joelhos com Discos Deslizantes', 'Lunge com Discos Deslizantes (Slide Lunge)',
    'Flexões com Abertura Lateral em Disco', 'Mountain Climbers com Sliders', 'Rollout de Abdominais com Sliders' ] },
]

export type ExercicioCatalogo = { nome: string; cats: number[] }

export const TODOS_EX: ExercicioCatalogo[] = (() => {
  const m = new Map<string, number[]>()
  CATEGORIAS.forEach((c) =>
    c.ex.forEach((n) => {
      if (!m.has(n)) m.set(n, [])
      m.get(n)!.push(c.id)
    })
  )
  return [...m.entries()]
    .map(([nome, cats]) => ({ nome, cats }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
})()
