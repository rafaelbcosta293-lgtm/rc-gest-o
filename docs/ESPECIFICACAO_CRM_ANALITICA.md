# RC Gestão: CRM visual, funil, alertas e centro analítico

> Especificação completa, colada pelo Rafael em 2026-10-29. Guardada aqui
> para as fases seguintes (ver `docs/FASE_1_AUDITORIA_E_PLANO.md`) a
> referenciarem sem repetir o texto todo.

---

## 0. Papel e forma de trabalhar

És o engenheiro principal da **RC Gestão**, a app de gestão interna dos estúdios **RC Private Fitness Studio** (Fátima e Leiria). A empresa é a Endeavor & Rise, Unipessoal, Lda.

O objetivo é transformar a app atual numa plataforma de gestão de nível profissional, com um CRM visual e analítico, um funil de vendas, alertas claros e um centro de análise com timeline, métricas, gráficos, objetivos e projeções.

A referência de *funcionalidade* são plataformas como a BMS (bmsnation.com). **Não copies** a marca, os textos, os logótipos nem o design deles. O design é o da RC: preto, cinza, branco, dourado mate e bege. O estilo é minimalista, sóbrio e executivo.

**Regras de trabalho:**
1. **Começa por auditar.** Antes de alterar seja o que for, lê o projeto inteiro. Depois apresenta-me:
   - a stack;
   - a estrutura de pastas;
   - o modelo de dados atual;
   - as áreas existentes;
   - a integração com o Google Calendar;
   - a autenticação e as permissões;
   - o que está partido ou incompleto.
2. **Não partas o que já funciona.** Cada alteração à base de dados é uma migração reversível. Não apagues dados reais.
3. **Trabalha por fases** (secção 10). No fim de cada fase:
   - corre os testes e o build;
   - mostra-me um resumo do que mudou e como testar;
   - espera pelo meu OK antes da fase seguinte.
4. **Usa a stack existente.**
   - Se o projeto usar Supabase, usa views e funções SQL para as métricas, e RLS para as permissões.
   - Se for React, os gráficos são feitos com Recharts. Noutra stack, com Chart.js ou equivalente leve.
   - Não acrescentes dependências pesadas sem justificar.
5. **A interface é em português de Portugal.** Formatos: datas DD/MM/AAAA, moeda em € com vírgula decimal, semanas a começar à segunda-feira, fuso Europe/Lisbon.
6. **Responsivo a sério.** Tem de funcionar em tablet (uso principal na receção e na sala) e em telemóvel.
7. Se uma decisão for ambígua, **pergunta-me** em vez de adivinhar.

---

## 1. Contexto do negócio (regras que a app tem de respeitar)

**Estrutura:**
- **2 estúdios:** Fátima e Leiria. Todos os dados pertencem a um estúdio. Há filtros por estúdio e uma vista consolidada.
- **Funções e permissões:**
  - **Administração** (só o Rafael, com login próprio): vê tudo, incluindo € e finanças.
  - **Coordenação / Studio Manager:** aniversários, reavaliações, leads sem seguimento, aberturas e fechos, escalas, PTs.
  - **Master Trainer:** qualidade dos treinos, avaliações e planos.
  - **Comercial:** leads, contactos, experimentais e vendas.
  - **PT:** treinos, avaliações e presenças. Vê apenas se o pagamento está **em dia ou não**, nunca valores.
  - **Regra de ouro:** valores em € e dados financeiros aparecem **só** na Administração. Isto aplica-se no backend (RLS ou equivalente), não apenas a esconder na interface.

**Modalidades:**
- **Treino Personalizado** (sala exclusiva, até 2 pessoas):
  - inscrição 45 €; seguro 18,50 €/ano;
  - 1x/semana: 50 min = 150 €/mês; 40 min = 110 €/mês;
  - 2x/semana = o dobro.
- **Treino Acompanhado** (Bloco Exclusivo, máximo 5 clientes por bloco):
  - inscrição 45 €; seguro 18,50 €/ano;
  - 60 € (1x/semana), 110 € (2x/semana), 150 € (3x/semana);
  - o bloco é fixo durante o mês, e a falta conta como sessão realizada;
  - a reavaliação está incluída de 3 em 3 meses; antecipar custa 25 €.

**Regras operacionais:**
- A mensalidade paga-se até ao **dia 8**.
- A desmarcação é permitida até 12 h antes.
- 3 desmarcações seguidas ou 6 acumuladas contam como sessão realizada.
- As sessões são válidas por 30 dias.
- O contrato tem um mínimo de 3 meses, e o **1.º mês é de experiência** (o cliente pode cancelar no fim desse mês).
- Os agendamentos estão em **Google Calendars partilhados**, um por estúdio. O cliente é reconhecido pelo primeiro e último nome.

**Definições comerciais:**
- **Lead nova do dia:** qualquer pessoa que pediu informações nesse dia, por qualquer meio, tenha ou não sido contactada.
- **Entrada de leads:** manual e por importação de folha de cálculo (CSV/XLSX, ou um link de Google Sheets com sincronização periódica).
- **Custo de referência do PT:** cerca de 8 €/hora, para cálculo de margens. Este valor tem de ser configurável.

**Nota:** se algum destes valores já estiver na app, a app prevalece. Assinala-me as diferenças.

---

## 2. Base de dados: o que acrescentar

Adapta ao modelo existente, sem duplicar tabelas que já existam.

1. **`leads`**, com os campos:
   - estúdio;
   - nome, telefone, email;
   - origem (Instagram, Facebook, Google, site, indicação de cliente, passagem na porta, telefone, parceria, evento, outro). A origem é configurável;
   - campanha (opcional);
   - modalidade de interesse;
   - objetivo do cliente;
   - comercial responsável;
   - **etapa do funil** e data de entrada em cada etapa;
   - motivo de perda;
   - temperatura (fria, morna, quente);
   - valor potencial mensal;
   - próxima ação e data da próxima ação.
2. **`lead_stage_history`**: cada mudança de etapa, com data, utilizador e etapa anterior/nova. É a base de todas as taxas de conversão e tempos.
3. **`activities`**: a timeline unificada. Cada linha é um evento de uma lead ou de um cliente:
   - chamada (atendida ou não atendida, com duração);
   - WhatsApp, SMS, email;
   - nota;
   - experimental agendada, realizada ou falhada;
   - venda;
   - pagamento;
   - treino realizado, falta, desmarcação;
   - avaliação;
   - alteração de plano;
   - suspensão, cancelamento, reativação;
   - aniversário enviado.

   Cada evento regista quem, quando, o estúdio e metadados em JSON. Os eventos de módulos já existentes passam a escrever aqui também, através de triggers ou da camada de serviço.
4. **`goals`**: objetivos por estúdio, por mês e por métrica (por exemplo, 30 vendas, 12.000 € de receita recorrente, churn abaixo de 4 %).
5. **`marketing_costs`**: custo por mês, por origem/campanha e por estúdio, para calcular o CAC.
6. **`alert_rules`** e **`alerts`**: o motor de alertas (secção 5).
7. **`kpi_snapshots_daily`**: uma fotografia diária das métricas principais, para a timeline histórica não depender de recalcular o passado.
8. **`settings`**: preços, custo/hora do PT, capacidade dos blocos, horários (07h00–21h00), limites dos alertas e metas por defeito.

Cria **dados de demonstração realistas** (12 meses, 2 estúdios, várias origens, conversões e churn plausíveis), **ativáveis apenas em ambiente de desenvolvimento**, para eu poder ver os gráficos com dados.

---

## 3. Funil de vendas

**Etapas** (configuráveis; estas por defeito):
1. **Nova:** pediu informações.
2. **Contactada:** primeiro contacto feito.
3. **Qualificada:** tem interesse real, objetivo identificado e horário compatível.
4. **Experimental agendada.**
5. **Experimental realizada** (ou **Falhou a experimental**, que leva a reagendar ou a perda).
6. **Proposta / Em decisão.**
7. **Ganha:** passa a cliente, cria a ficha de cliente e o pagamento, e liga o histórico.
8. **Perdida:** com motivo obrigatório (preço, horário, distância, sem resposta, escolheu concorrência, adiou, outro).

**Vistas do funil:**
- **Kanban**, com arrastar e largar entre etapas. Cada cartão mostra:
  - nome, origem, dias na etapa e próxima ação;
  - cor de urgência: verde em dia, âmbar a vencer, vermelho atrasado.
- **Gráfico de funil**, com volume e taxa de conversão entre cada par de etapas, e a perda em cada etapa.
- **Lista/tabela**, com filtros (estúdio, comercial, origem, período, etapa, temperatura) e pesquisa.
- **Ficha da lead:**
  - dados;
  - **timeline completa** de todas as interações;
  - botões rápidos: ligar, WhatsApp com mensagem padrão editável, registar chamada, agendar experimental (a criar o evento no Google Calendar do estúdio), mudar etapa.

**Métricas do funil** (por período, estúdio, comercial e origem):
- Taxa de contacto = contactadas ÷ novas
- **Speed to lead**: tempo médio desde a entrada até ao primeiro contacto
- Taxa de qualificação = qualificadas ÷ contactadas
- Taxa de agendamento = experimentais agendadas ÷ contactadas com sucesso
- **Show rate** = experimentais realizadas ÷ agendadas
- **Taxa de fecho** = ganhas ÷ experimentais realizadas
- Conversão global = ganhas ÷ novas
- Tempo médio em cada etapa e ciclo de venda total
- Contactos necessários por venda
- Motivos de perda (ranking)
- Comparação de conversão por origem e por comercial

---

## 4. CRM visual e analítico: painéis

Cada painel tem:
- seletor de período: hoje, semana, mês, trimestre, ano, ou datas à medida;
- comparação automática com o período anterior e com o mesmo período do ano passado (setas e % de variação);
- filtro por estúdio.

### 4.1 Quadro do dia (Comercial e Coordenação)
- O quadro-resumo que já existe, mais visual: leads novas hoje, contactos feitos hoje, contactos com sucesso, experimentais agendadas, experimentais para hoje e vendas hoje.
- Uma barra de progresso face à meta diária, que é derivada da meta mensal.
- A **lista "Fazer agora"**: as próximas ações ordenadas por urgência.

### 4.2 Painel comercial
- Funil (gráfico) e Kanban.
- Evolução de leads, experimentais e vendas por semana (linhas).
- Leads por origem (barras), com conversão e CAC por origem (este só na Administração).
- Ranking de comerciais: contactos, agendamentos, show rate, fecho e vendas.
- Mapa de calor **dia da semana × hora** das entradas de leads e dos contactos com sucesso, para perceber a melhor hora para ligar.

### 4.3 Painel de clientes e retenção
- Clientes ativos, novos, cancelados, suspensos e reativados (timeline).
- **Churn mensal** de clientes; taxa de cancelamento no fim do 1.º mês de experiência.
- **Coortes de retenção**: uma matriz por mês de entrada, com a % que continua ativa no mês 1, 2, 3… 12.
- Tempo médio de vida do cliente.
- **Assiduidade:** treinos realizados ÷ previstos, com a previsão ajustada às semanas e meias-semanas de cada mês (já existe essa lógica; reutiliza-a).
- **Score de risco de saída** por cliente, de 0 a 100. Combina:
  - quebra de assiduidade;
  - desmarcações;
  - ausência de treino agendado;
  - pagamento em atraso;
  - reavaliação vencida;
  - estar no fim do mês de experiência.

  Lista dos clientes em risco, com uma ação sugerida.
- Mix por modalidade e frequência (1x, 2x ou 3x por semana) e a sua evolução.

### 4.4 Painel operacional
- **Ocupação:** horas de PT vendidas ÷ disponíveis; ocupação dos Blocos Exclusivos (lugares ocupados ÷ 5), em mapa de calor por bloco horário.
- Produtividade por PT (sem €): horas, treinos de 40 e 60 min, avaliações feitas, retenção dos clientes do PT e assiduidade média dos seus clientes.
- Reavaliações feitas, a vencer e atrasadas.
- Aberturas e fechos submetidos ou em falta.
- Manutenção de máquinas, se o módulo existir: próximas, atrasadas e inoperacionais.

### 4.5 Painel financeiro (só Administração)
- **Receita recorrente mensal (MRR)** e anualizada (ARR), com timeline.
- Movimento do MRR por mês: novo + expansão (upgrade de frequência) − contração (downgrade) − churn + reativação.
- Receita por estúdio, por modalidade e por tipo (mensalidades, inscrições, seguros, toalhas, reavaliações antecipadas).
- **ARPU** (receita média por cliente).
- **Pagamentos:** taxa de pagamento até ao dia 8, valor em atraso e antiguidade da dívida (1–8, 9–30, 31–60, mais de 60 dias).
- **Unit economics:**
  - CAC por origem e global = custo de marketing ÷ clientes ganhos;
  - **LTV** = ARPU × margem bruta ÷ churn mensal;
  - rácio LTV/CAC;
  - meses para recuperar o CAC.
- **Margem:** receita por hora de PT vs custo por hora de PT (configurável), margem por modalidade e por estúdio.
- Exportação para CSV/XLSX e PDF do resumo mensal (para o contabilista e para mim).

### 4.6 Timeline da empresa
Uma vista cronológica com os marcos e os dados históricos (a partir de `kpi_snapshots_daily`), com zoom de dia, semana, mês e ano. Nela aparecem:
- picos de leads;
- vendas;
- entradas e saídas de PTs;
- campanhas;
- alterações de preço;
- metas atingidas.

Posso adicionar marcos manuais (por exemplo, "campanha Instagram outubro" ou "novo PT em Leiria"), para cruzar acontecimentos com os resultados.

---

## 5. Motor de alertas

Cada alerta tem:
- **severidade:** Crítico (vermelho), Atenção (âmbar) ou Info (cinza/dourado);
- **destinatário** (função e/ou pessoa) e **estúdio**;
- **ação direta:** um botão que abre a ficha ou executa a ação;
- estados: novo, visto, resolvido ou adiado (com nova data);
- **resolução automática** quando a condição deixa de se verificar.

Os limites são todos configuráveis em `settings`.

**Funcionamento:**
- Há um **centro de alertas** com um contador no topo da app e alertas agrupados por severidade.
- Há um **resumo diário** dos alertas abertos por função no início do dia.
- As regras correm agendadas (cron / pg_cron / função agendada) e também quando há eventos relevantes.

**Regras iniciais:**

| Área | Regra | Severidade |
|---|---|---|
| Leads | Lead nova sem contacto há mais de 2 h (horário de expediente) | Atenção, que passa a Crítico às 24 h |
| Leads | Lead sem seguimento há mais de 3 dias, ou próxima ação vencida | Crítico |
| Leads | Experimental amanhã sem confirmação | Atenção |
| Leads | Experimental falhada sem reagendamento há 48 h | Crítico |
| Leads | Experimental realizada sem decisão há 5 dias | Atenção |
| Clientes | **Cliente ativo sem treino agendado** (cruzar com o Google Calendar) | Crítico |
| Clientes | Queda de assiduidade de 30 % ou mais face à média das 4 semanas anteriores | Atenção |
| Clientes | Aproximação ao limite de desmarcações (2 seguidas ou 5 acumuladas) | Atenção |
| Clientes | Cliente a 7 dias do fim do mês de experiência | Atenção |
| Clientes | Score de risco de saída acima de 70 | Crítico |
| Clientes | Reavaliação a 14 dias / reavaliação atrasada | Info / Atenção |
| Clientes | Aniversário hoje (com botão de enviar mensagem) | Info |
| Pagamentos | Mensalidade por pagar após o dia 8 | Crítico (o PT vê só "pagamento em atraso") |
| Pagamentos | Plano a expirar em 7 dias | Atenção |
| Operação | Bloco Exclusivo cheio (5/5) com lista de espera / bloco com menos de 40 % de ocupação | Info |
| Operação | Escala com slot sem PT, ou PT acima de X horas semanais | Atenção |
| Operação | Abertura/fecho não submetido até 30 min após o horário | Crítico |
| Operação | Manutenção de máquina vencida ou máquina inoperacional | Atenção |
| Gestão | **Meta mensal em risco**: a projeção ao ritmo atual fica abaixo de 90 % da meta | Crítico (Administração/Coordenação) |
| Gestão | Churn do mês acima da média dos últimos 6 meses | Crítico (Administração) |
| Gestão | Conversão de uma origem caiu mais de 25 % face ao mês anterior | Atenção |

---

## 6. Objetivos, projeções e simulador (planeamento do futuro)

### 6.1 Objetivos
- Defino metas mensais e anuais por estúdio e por métrica: leads, vendas, clientes ativos, MRR, churn, show rate, ocupação, entre outras.
- Para cada meta, a app mostra:
  - progresso atual;
  - **projeção de fecho do mês** ao ritmo atual;
  - ritmo diário necessário para lá chegar;
  - semáforo de estado.
- **Calculadora de funil inverso:** "Quero X clientes novos por mês". A app calcula, com as taxas reais dos últimos 3 meses, quantas leads, contactos e experimentais são precisas, e quanto investimento em marketing (pelo CAC atual).

### 6.2 Projeções
- Previsão de clientes ativos e de MRR para os próximos **3, 6, 12 e 24 meses**, com base em:
  - entradas de leads (com sazonalidade, se houver histórico de 12 meses ou mais);
  - conversão;
  - churn;
  - mix de modalidades.
- Três cenários: **pessimista, base e otimista**, mostrados num gráfico com intervalo.
- **Planeamento de capacidade:** quando a ocupação projetada ultrapassa 85 %, a app indica o mês em que vai ser preciso contratar outro PT ou abrir mais Blocos Exclusivos.

### 6.3 Simulador "E se…" (só Administração)
**Sliders e campos:**
- leads por mês;
- taxa de fecho;
- show rate;
- churn;
- preços por modalidade e mix de modalidades;
- nº de PTs e custo por hora;
- custo de marketing;
- **abrir um 3.º estúdio** (com custos fixos e uma curva de arranque).

**Resultado em tempo real:**
- clientes;
- MRR;
- margem;
- ponto de equilíbrio;
- LTV/CAC;
- comparação lado a lado com o cenário atual.

Posso **guardar cenários com nome** e compará-los.

---

## 7. Ferramentas de gestão adicionais

- **Relatório mensal automático** (PDF ou ecrã), por estúdio e consolidado: KPIs principais, gráficos, metas vs real, destaques e alertas.
- **Exportação** de qualquer tabela e gráfico (CSV/XLSX/PNG).
- **Pesquisa global** de clientes, leads e PTs.
- **Registo de auditoria:** quem alterou o quê e quando, sobretudo em pagamentos e preços.
- **Definição de métricas:** cada KPI tem um ícone ⓘ com a fórmula exata, para todos lerem os números da mesma forma.

---

## 8. Design e UX

- Paleta RC:
  - fundo branco ou bege claro;
  - texto preto/cinza;
  - **dourado mate** para destaques e metas;
  - vermelho, âmbar e verde **apenas** nos estados e alertas.
- Também tem de haver modo escuro: preto com dourado.
- Cartões de KPI com o número grande, a variação face ao período anterior e um mini-gráfico (sparkline).
- Gráficos limpos, sem 3D, com legendas claras, valores ao tocar ou passar o rato, e eixos com unidades.
- Navegação por função: cada pessoa entra e vê primeiro o seu painel.
- Tudo utilizável com o dedo no tablet: alvos de toque de pelo menos 44 px e o Kanban a funcionar com toque.
- Estados vazios explicativos e carregamentos rápidos. As métricas pesadas são pré-calculadas (views materializadas ou snapshots).

---

## 9. Qualidade

- Testes unitários às fórmulas de **todas** as métricas (conversões, churn, MRR, LTV, CAC, assiduidade prevista por mês, projeções).
- Testes de permissões: um PT **nunca** recebe valores em €, nem pela API.
- Validação dos KPIs com os dados de demonstração, mostrando-me uma tabela de verificação: valor esperado vs calculado.
- Sem erros de build nem de lint. Desempenho aceitável num tablet médio.
- Documentação curta em `docs/`: modelo de dados, fórmulas dos KPIs, regras de alertas e como alterar os limites.

---

## 10. Fases de entrega (para no fim de cada uma e mostra-me)

1. **Auditoria e plano:** relatório da app atual e plano técnico detalhado desta especificação adaptado ao código existente.
2. **Base de dados e timeline:** migrações, `activities`, histórico de etapas, settings, permissões financeiras no backend e dados de demonstração.
3. **Funil e CRM:** Kanban, ficha da lead com timeline, ações rápidas, importação de leads (CSV/XLSX/Google Sheets) e métricas do funil.
4. **Motor de alertas:** regras, centro de alertas, resolução automática e resumo diário.
5. **Painéis:** quadro do dia, comercial, clientes/retenção, operacional, financeiro e timeline da empresa.
6. **Objetivos, projeções e simulador.**
7. **Relatórios, exportações, auditoria, polimento visual e documentação.**

Começa já pela **Fase 1**. Não escrevas código de funcionalidades antes de eu aprovar o plano.
