# Fatijardins

Aplicação de gestão interna da **Fatijardins**, empresa de manutenção e construção de jardins.
Serve para organizar a **equipa**, os **clientes** e os **locais**, a **agenda** dos trabalhos, o
**registo** do que se faz no local e as **horas** de cada pessoa. Foi pensada primeiro para o
**telemóvel** (pode ser instalada como uma app) e funciona também no **PC**.

> **Estado:** fases 1 (Base) e 2 (Campo) concluídas. Ver o [roteiro](#12-roteiro-das-fases) no fim.

**Índice:** [O que faz](#o-que-a-app-faz) ·
[Tecnologia](#tecnologia) ·
[Pastas](#estrutura-de-pastas) ·
[Perfis e permissões](#perfis-e-permissões) ·
[Requisitos](#requisitos) ·
[1) Instalar](#1-instalar) ·
[2) Supabase](#2-projeto-supabase) ·
[3) Migrações](#3-aplicar-as-migrações-criar-as-tabelas) ·
[4) Autenticação](#4-configurar-a-autenticação-no-painel-do-supabase) ·
[5) Variáveis](#5-variáveis-de-ambiente) ·
[6) Correr](#6-correr-localmente) ·
[7) Tipos](#7-gerar-os-tipos-da-base-de-dados) ·
[8) Verificar](#8-verificar-o-código) ·
[9) Vercel](#9-publicar-na-vercel) ·
[10) Telemóvel](#10-instalar-no-telemóvel) ·
[11) Decisões](#11-decisões-tomadas) ·
[12) Roteiro](#12-roteiro-das-fases)

---

## O que a app faz

- **Entrar** com email e palavra-passe, **recuperar** a palavra-passe por email e **mudá-la** no Perfil.
- **Início:** números de clientes, locais, colaboradores e equipas (gerente e chefes) ou a minha
  equipa (colaboradores), e as próximas ausências.
- **Equipa:**
  - colaboradores (função, perfil, contactos, equipa e custo/hora — este só o gerente vê);
  - equipas (nome, cor, chefe e membros);
  - ausências (férias, doença, formação, falta, outro);
  - acesso à app: o gerente cria a conta, repõe a palavra-passe ou retira o acesso.
- **Clientes e locais:** dados de faturação (NIF validado), contactos e os locais de trabalho de cada
  cliente (morada, coordenadas, área do jardim), com ligações diretas para o Google Maps e o Waze.
- **Agenda** (gerente e chefes): semana e dia por equipa, arrastar e largar para mudar o dia, a
  equipa ou a ordem de passagem (no telemóvel, botões ↑/↓); trabalhos pontuais ou que se repetem
  (todas as semanas, de 15 em 15 dias ou todos os meses), por atribuir, cancelar e reativar; ausências
  e feriados nacionais assinalados.
- **O meu dia** (Início do colaborador e do chefe): os trabalhos de hoje pela ordem de passagem,
  com morada, notas para a equipa, “Navegar” (Google Maps/Waze), “Ligar” e a picagem de horas.
- **Ficha do trabalho / registo diário**, pensada para o telemóvel no local: iniciar e concluir,
  tarefas feitas, notas, materiais gastos, fotos antes/depois tiradas com a câmara (comprimidas no
  telemóvel antes de enviar: máx. 1600 px, JPEG), assinatura do cliente no ecrã e horas do trabalho.
- **Horas:** picagem de entrada/saída (com localização opcional) e troca de trabalho; mapa mensal
  por pessoa com horas por dia e por trabalho, horas extra (acima de 8 h nos dias úteis e todas as
  horas em fins de semana e feriados), exportação para Excel (CSV) individual ou da equipa, e
  correções feitas pelo gerente.
- **App instalável** no telemóvel (PWA), com uma página “Sem ligação à internet” quando não há rede.

## Tecnologia

| Parte | O que se usa |
| --- | --- |
| Aplicação web | [Next.js 16](https://nextjs.org) (App Router, Server Actions, Cache Components), React 19, TypeScript |
| Aspeto | Tailwind CSS v4, componentes [shadcn/ui](https://ui.shadcn.com) (sobre Radix UI), ícones lucide-react, avisos sonner |
| Formulários | react-hook-form + Zod 4 (mensagens em português) |
| Base de dados e contas | [Supabase](https://supabase.com) (PostgreSQL, Auth e Row Level Security), ligado com `@supabase/ssr` |
| Alojamento | [Vercel](https://vercel.com) (app) e Supabase (base de dados, região de Paris) |

## Estrutura de pastas

A app vive na pasta `fatijardins/` (o resto do repositório é outra aplicação, a “RC”).

```text
fatijardins/
├── app/                      Páginas (cada pasta é um endereço)
│   ├── (auth)/               Entrar, recuperar e atualizar palavra-passe, sem acesso
│   ├── (app)/                Páginas com sessão iniciada (menu, Início, Agenda, Clientes, …)
│   │   ├── _inicio/          Início: “O meu dia” e o resumo do gerente
│   │   ├── agenda/           Calendário semanal e diário por equipa
│   │   ├── trabalhos/        Criar/editar trabalhos (+ acoes.ts) e a ficha com o registo diário
│   │   ├── horas/            Mapa mensal, correções e exportação CSV (+ picagem em acoes.ts)
│   │   ├── clientes/         Clientes e os seus locais (+ acoes.ts: gravar na base de dados)
│   │   ├── equipa/           Colaboradores, equipas, ausências e acessos (+ acoes.ts)
│   │   └── perfil/           Dados da conta e mudar palavra-passe
│   ├── auth/confirm/         Destino das ligações enviadas por email
│   ├── offline/              Página “Sem ligação à internet”
│   ├── manifest.ts           Manifesto da app instalável (/manifest.webmanifest)
│   ├── favicon.ico, icon.svg, apple-icon.png   Ícones do browser e do iPhone
│   └── layout.tsx            Estrutura comum a todas as páginas
├── components/               Peças reutilizáveis (cabeçalho, logótipo, menu…)
│   ├── horas/                Picagem de horas (usada no Início e na ficha do trabalho)
│   └── ui/                   Botões, campos, cartões, diálogos (shadcn/ui)
├── hooks/                    use-acao-formulario.ts (envio de formulários)
├── lib/                      Lógica partilhada
│   ├── supabase/             Ligação ao Supabase e tipos da base de dados
│   ├── validacao/            Regras dos formulários (NIF, código postal, telefone…)
│   ├── auth.ts, perfis.ts    Sessão e perfis
│   ├── formatar.ts, datas.ts Datas, horas, euros, semanas e feriados nacionais
│   ├── trabalhos.ts          Estados, tipos e repetições dos trabalhos
│   ├── horas.ts              Contas das horas (por dia, extras, por trabalho)
│   └── fotos.ts              Compressão das fotos no telemóvel antes de enviar
├── public/
│   ├── icons/                Ícones da app instalada
│   └── sw.js                 Service worker (página offline e cache de ficheiros estáticos)
├── scripts/gerar-icones.mjs  Volta a gerar os ícones a partir do símbolo
├── supabase/
│   ├── migrations/           SQL que cria as tabelas e as permissões (por ordem de data)
│   ├── seed.sql              Dados de exemplo (contas, equipas, clientes, locais, trabalhos, horas)
│   └── tests/                Testes das permissões (rls_fase1.sql, rls_fase2.sql)
├── proxy.ts                  Envia para /login quem não tem sessão
├── .env.example              Modelo das variáveis de ambiente
└── package.json              Dependências e comandos (npm run …)
```

## Perfis e permissões

Cada pessoa da empresa é um **colaborador**. Quem precisa de usar a app tem também uma **conta de
acesso** (email e palavra-passe) ligada à sua ficha. Há três perfis:

| O que pode fazer | Gerente | Chefe de equipa | Colaborador |
| --- | :---: | :---: | :---: |
| Ver colaboradores e equipas | ✅ | ✅ | ✅ |
| Criar e alterar colaboradores (desativam-se, não se apagam) | ✅ | — | — |
| Criar, alterar e apagar equipas | ✅ | — | — |
| Ver e alterar o custo/hora dos colaboradores | ✅ | — | — |
| Ver ausências | todas | as da sua equipa | só as suas |
| Marcar e apagar ausências | ✅ | — | — |
| Ver, criar e alterar clientes e locais | ✅ | ✅ | ver os dos trabalhos de hoje |
| Apagar clientes e locais | ✅ | — | — |
| Criar acessos, repor palavras-passe, retirar acessos | ✅ | — | — |
| Ver a agenda | toda | as equipas que chefia | — (vê “O meu dia”) |
| Criar, mover, reordenar, cancelar trabalhos | ✅ | nas equipas que chefia | — |
| Ver trabalhos | todos | os das suas equipas | só os de hoje da sua equipa |
| Iniciar/concluir, registar tarefas, materiais, fotos, assinatura | ✅ | ✅ | nos trabalhos de hoje |
| Reabrir ou cancelar trabalhos | ✅ | nas equipas que chefia | — |
| Apagar ou substituir uma assinatura já feita | ✅ | ✅ | — |
| Apagar fotos | ✅ | ✅ | só as suas |
| Picar entrada/saída (hora do servidor) | ✅ | ✅ | ✅ |
| Ver horas | de todos | da sua equipa | só as suas |
| Ver o local onde se picou | ✅ | — | — |
| Corrigir horas à mão, exportar a equipa | ✅ | — | — |
| Mudar a própria palavra-passe | ✅ | ✅ | ✅ |

**Onde são aplicadas** (do mais importante para o menos importante):

1. **Na base de dados — Row Level Security (RLS).** É a proteção real: as regras estão nas
   migrações de `supabase/migrations/` e o PostgreSQL recusa ler ou gravar o que o perfil não
   permite, venha o pedido de onde vier. Uma conta sem colaborador ativo não vê nada. Gatilhos
   (*triggers*) garantem as regras que a RLS sozinha não cobre: nunca ficar sem gerente ativo; o
   colaborador só iniciar ou concluir trabalhos; a autoria e a data da assinatura serem as do
   servidor; um trabalho com horas, registo ou fotos não mudar de dia.
2. **No servidor (Server Actions, ficheiros `acoes.ts`).** Antes de gravar, confirmam a sessão e o
   perfil e validam os dados com as mesmas regras do formulário (`lib/validacao/`).
3. **Na interface.** Esconde menus e botões que a pessoa não pode usar
   (`components/navegacao/itens.ts`, `exigirPerfil()` em `lib/auth.ts`). É só conforto: a segurança
   está nos pontos 1 e 2.

## Requisitos

- **Node.js 20.9 ou mais recente** (recomendado: a versão LTS mais recente, em
  [nodejs.org](https://nodejs.org)). Para confirmar: `node -v`.
- **Conta Supabase** ([supabase.com](https://supabase.com)) — o plano gratuito chega para começar.
- **Conta Vercel** ([vercel.com](https://vercel.com)) ligada ao GitHub. Atenção: o plano gratuito
  (Hobby) da Vercel é só para uso não comercial; para a empresa use o plano Pro.
- Git e um editor de código (ex.: Visual Studio Code).

## 1) Instalar

```bash
git clone https://github.com/rafaelbcosta293-lgtm/rc-gest-o.git
cd rc-gest-o/fatijardins
npm install
```

Todos os comandos seguintes correm **dentro da pasta `fatijardins`**.

## 2) Projeto Supabase

**Já existe um projeto criado:** “fatijardins”, com a referência (ref) `iodjvvtumuhlvdsemhbb`, na
região **eu-west-3 (Paris)**, com as migrações e os dados de exemplo já aplicados. O endereço é
`https://iodjvvtumuhlvdsemhbb.supabase.co`. Se vai usar este projeto, passe ao
[passo 4](#4-configurar-a-autenticação-no-painel-do-supabase), mas leia primeiro o aviso abaixo.

> 🔒 **Contas de demonstração.** Este projeto tem as 6 contas de exemplo (incluindo um **gerente**)
> com a palavra-passe `Fatijardins2026!`, que está escrita neste repositório **público**. Servem
> para testar no computador. **Antes de publicar a app na Vercel** (passo 9), apague-as ou mude-lhes
> a palavra-passe, seguindo os passos em [Dados de exemplo](#dados-de-exemplo).

**Para criar um projeto de raiz:**

1. Entre em [supabase.com](https://supabase.com) → **New project**.
2. Escolha a organização, dê um nome (ex.: `fatijardins`) e uma **palavra-passe da base de dados**
   forte. **Guarde-a** num gestor de palavras-passe: é pedida pela Supabase CLI.
3. Escolha uma região próxima de Portugal (ex.: **West EU (Paris)**) e clique **Create new project**.
4. Espere uns minutos até o projeto estar pronto. A referência (ref) aparece no endereço do painel
   (`supabase.com/dashboard/project/<ref>`) e em **Project Settings → General**.

## 3) Aplicar as migrações (criar as tabelas)

As migrações são os ficheiros SQL em `supabase/migrations/`. Aplicam-se **por ordem** (o número no
início do nome é a data).

**Opção A — Supabase CLI (recomendado)**

```bash
npx supabase login                          # abre o browser para autorizar
npx supabase init                           # só se ainda não existir supabase/config.toml
npx supabase link --project-ref <ref>       # ex.: iodjvvtumuhlvdsemhbb (pede a palavra-passe da BD)
npx supabase db push                        # aplica as migrações que faltam
```

**Opção B — SQL Editor do painel**

1. No painel do projeto, abra **SQL Editor** → **New query**.
2. Abra cada ficheiro de `supabase/migrations/` por ordem, copie todo o conteúdo, cole e clique **Run**.

A migração da fase 2 cria também o espaço de ficheiros (**Storage**) `fotos`, privado, onde ficam as
fotos dos trabalhos e as assinaturas, com as mesmas regras de acesso dos trabalhos (só JPEG ou PNG,
até 3 MB por ficheiro). Não é preciso configurar nada no painel. Com a compressão (cerca de
200–400 KB por foto), o 1 GB do plano gratuito dá para alguns milhares de fotos.

### Dados de exemplo

Para experimentar a app, cole o conteúdo de `supabase/seed.sql` no **SQL Editor** e clique **Run**.
Cria 2 equipas, 7 colaboradores, 8 clientes, 12 locais, trabalhos (hoje, no último e no próximo dia
útil, mais uma série semanal), 2 registos com materiais, horas do último dia útil e estas contas,
todas com a palavra-passe **`Fatijardins2026!`**:

| Email | Nome | Perfil | Equipa |
| --- | --- | --- | --- |
| gerente@example.com | Marta Fonseca | Gerente | — |
| chefe.verde@example.com | Rui Carvalho | Chefe de equipa | Equipa Verde |
| chefe.terra@example.com | Sofia Lopes | Chefe de equipa | Equipa Terra |
| tiago@example.com | Tiago Mendes | Colaborador | Equipa Verde |
| nuno@example.com | Nuno Pires | Colaborador | Equipa Verde |
| ines@example.com | Inês Rocha | Colaboradora | Equipa Terra |

(O Jorge Dias, da Equipa Terra, é um colaborador **sem** conta de acesso.)

As datas dos trabalhos e das horas de exemplo são calculadas a partir do dia em que a seed corre. No
projeto já criado foram carregadas a 13/10/2026: para ver “O meu dia” com trabalhos noutro dia,
crie-os na Agenda.

> ⚠️ **Antes de usar a app a sério**, apague estas contas (ou mude-lhes a palavra-passe) — toda a
> gente conhece esta palavra-passe. Ordem sugerida:
>
> 1. Entre como `gerente@example.com`, crie em **Equipa** a ficha do gerente verdadeiro (perfil
>    Gerente) e o seu acesso à app.
> 2. Termine a sessão e entre com a conta do gerente verdadeiro.
> 3. Apague as contas de exemplo no **SQL Editor** (as fichas ficam, mas sem conta):
>
>    ```sql
>    delete from auth.users where email like '%@example.com';
>    ```
>
>    (Em alternativa: em cada colaborador, **Acesso à app → Retirar acesso**, ou no painel em
>    *Authentication → Users*.)
> 4. Na app, desative os colaboradores de exemplo e apague (ou desative) as equipas e os clientes
>    de exemplo.
> 5. Confirme que só ficaram os acessos que espera:
>
>    ```sql
>    select nome, perfil, ativo, user_id is not null as tem_acesso
>    from public.colaboradores
>    where user_id is not null or perfil = 'gerente';
>    ```

### Primeiro gerente (se não usar os dados de exemplo)

1. **Authentication → Users → Add user → Create new user**: indique o email e uma palavra-passe e
   marque **Auto Confirm User**.
2. No **SQL Editor**, ligue essa conta a uma ficha de gerente (troque o nome e o email):

```sql
insert into public.colaboradores (user_id, nome, funcao, perfil, email)
select id, 'Nome do Gerente', 'Gerente', 'gerente', email
from auth.users
where email = 'gerente@fatijardins.pt';
```

A partir daí, o gerente cria os restantes colaboradores e acessos na própria app (Equipa).

### Testes de permissões

Com os dados de exemplo carregados **no próprio dia** (os testes da fase 2 contam os trabalhos de
“hoje”), cole `supabase/tests/rls_fase1.sql` e depois `supabase/tests/rls_fase2.sql` no
**SQL Editor** e clique **Run**. O teste corre dentro de uma transação e desfaz tudo no fim (*rollback*), por isso **não
altera dados**. Se alguma regra estiver errada aparece um erro `FALHOU: …`; se tudo estiver bem,
termina sem erros.

## 4) Configurar a autenticação no painel do Supabase

Os nomes dos menus podem mudar ligeiramente com as atualizações do painel.

1. **Desligar o registo público** — **Authentication → Sign In / Providers** → desligue
   **Allow new users to sign up** e guarde. As contas são criadas pelo gerente, dentro da app.
2. **Endereços** — **Authentication → URL Configuration**:
   - **Site URL:** o endereço público da app (ex.: `https://fatijardins.vercel.app`). Enquanto só
     testa no computador pode usar `http://localhost:3000`.
   - **Redirect URLs:** acrescente `http://localhost:3000/**` e o domínio da Vercel
     (ex.: `https://fatijardins.vercel.app/**`, e o domínio próprio, se tiver).
3. **Email de recuperação de palavra-passe** — **Authentication → Emails → Templates → Reset
   Password**. Este formato funciona mesmo que o email seja aberto noutro browser ou na app de
   email do telemóvel. Texto sugerido:

   - **Subject:** `Definir nova palavra-passe — Fatijardins`
   - **Body:**

   ```html
   <h2>Definir nova palavra-passe</h2>
   <p>Olá,</p>
   <p>Recebemos um pedido para definir uma nova palavra-passe da sua conta na app Fatijardins.</p>
   <p>
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&seguinte=/atualizar-palavra-passe">
       Definir nova palavra-passe
     </a>
   </p>
   <p>A ligação só pode ser usada uma vez e expira ao fim de algum tempo.</p>
   <p>Se não foi você que pediu, ignore este email: a sua palavra-passe não muda.</p>
   <p>— Fatijardins</p>
   ```

4. **Palavras-passe** — em **Authentication → Sign In / Providers → Email**: defina o
   **comprimento mínimo em 8** (o mesmo que a app pede) e, se o plano o permitir, ative a
   **proteção contra palavras-passe divulgadas** (*Prevent use of leaked passwords*, planos pagos).
5. **Envio de emails** — o serviço de email incluído no Supabase é só para testes (poucos emails
   por hora e, em projetos novos, só para membros da equipa do projeto). Para os colaboradores
   receberem o email de recuperação, configure um servidor SMTP próprio em
   **Authentication → Emails → SMTP Settings** (ex.: Brevo, Resend, Amazon SES ou o email da
   empresa).

## 5) Variáveis de ambiente

Copie o modelo e preencha-o:

```bash
cp .env.example .env.local
```

| Variável | Onde encontrar | Pública? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API → Project URL** (ou botão **Connect**). Ex.: `https://iodjvvtumuhlvdsemhbb.supabase.co` | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys → Publishable key** (`sb_publishable_…`). Em projetos antigos: separador *Legacy API Keys* → `anon` | Sim (protegida pela RLS) |
| `SUPABASE_SECRET_KEY` | **Project Settings → API Keys → Secret keys** (`sb_secret_…`, clique para revelar ou crie uma). Em projetos antigos: `service_role` | **Não — secreta** |
| `NEXT_PUBLIC_SITE_URL` | O endereço público da app, sem `/` no fim. Local: `http://localhost:3000`; Vercel: `https://fatijardins.vercel.app` | Sim |

- A **chave secreta** dá acesso total à base de dados: só existe no servidor, nunca a partilhe nem
  a envie para o Git. Só é necessária para o gerente **criar acessos** e **repor palavras-passe**;
  sem ela, o resto da app funciona.
- O ficheiro `.env.local` já está no `.gitignore` (não vai para o GitHub).
- Depois de mudar o `.env.local`, pare e volte a arrancar o `npm run dev`.

## 6) Correr localmente

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e entre, por exemplo, com
`gerente@example.com` / `Fatijardins2026!`. As páginas atualizam-se sozinhas quando se altera o
código.

O service worker (app instalável e página offline) só é ativado na versão de produção. Para o
experimentar no computador: `npm run build` e depois `npm start`.

## 7) Gerar os tipos da base de dados

Sempre que mudar tabelas ou colunas (nova migração), atualize os tipos TypeScript em
`lib/supabase/database.types.ts`:

```bash
npx supabase login      # só da primeira vez
npm run tipos
```

O comando usa o projeto `iodjvvtumuhlvdsemhbb`. Se usar outro projeto, troque a referência no
script `tipos` do `package.json`.

## 8) Verificar o código

```bash
npm run lint        # regras de qualidade (ESLint)
npm run typecheck   # erros de tipos (TypeScript)
npm run build       # compila como na Vercel; se passar aqui, deve passar lá
```

## 9) Publicar na Vercel

> ⚠️ **Antes de publicar:** apague as contas de demonstração ou mude-lhes a palavra-passe (ver
> [Dados de exemplo](#dados-de-exemplo)). Depois de publicada, qualquer pessoa pode abrir a página de
> entrada, e a palavra-passe de exemplo é pública.

1. Em [vercel.com](https://vercel.com) → **Add New… → Project** → importe o repositório do GitHub.
2. Em **Root Directory** clique **Edit** e escolha **`fatijardins`**.
3. **Framework Preset:** Next.js (é detetado sozinho). Deixe os comandos por omissão.
4. Em **Environment Variables** acrescente as 4 variáveis do [passo 5](#5-variáveis-de-ambiente),
   com `NEXT_PUBLIC_SITE_URL` igual ao endereço da Vercel (ex.: `https://fatijardins.vercel.app`).
5. Clique **Deploy**. Cada `git push` passa a publicar uma nova versão automaticamente.
6. Recomendado: em **Settings → Functions → Function Region** escolha **Paris (cdg1)**, a mesma
   região do Supabase (a app fica mais rápida).
7. No Supabase, atualize **Site URL** e **Redirect URLs** com o endereço final (passo 4).

As variáveis `NEXT_PUBLIC_…` ficam gravadas na compilação: se as mudar, faça **Redeploy**.

> **Nota sobre o repositório:** a app vive na subpasta `fatijardins/` de um repositório partilhado
> com outra aplicação (a “RC”). Funciona assim, mas a Vercel vai reconstruir também quando só a
> outra app mudar. Recomenda-se passar a Fatijardins para um repositório próprio, mantendo o
> histórico:
>
> ```bash
> # na raiz do repositório rc-gest-o
> git subtree split -P fatijardins -b fatijardins-so
> # crie um repositório vazio no GitHub (ex.: fatijardins) e depois:
> git push https://github.com/<utilizador>/fatijardins.git fatijardins-so:main
> ```
>
> Nesse repositório novo a app fica na raiz, por isso na Vercel o **Root Directory** fica vazio.

## 10) Instalar no telemóvel

A app tem de estar publicada com `https://` (a Vercel já o faz).

- **Android (Chrome):** abra o endereço da app → menu **⋮** → **Instalar app** (ou **Adicionar ao
  ecrã principal**) → **Instalar**.
- **iPhone (Safari):** abra o endereço no **Safari** → botão **Partilhar** (quadrado com seta para
  cima) → **Adicionar ao ecrã principal** → **Adicionar**.
- **PC (Chrome ou Edge):** clique no ícone de instalar na barra de endereço.

A app abre em ecrã inteiro, com o ícone da Fatijardins, e atualiza-se sozinha sempre que é
publicada uma nova versão. Precisa de internet para mostrar dados (os dados não ficam guardados no
telemóvel, por segurança); sem rede aparece a página “Sem ligação à internet”, que volta a tentar
sozinha quando a ligação regressa.

Para trocar o símbolo pelo logótipo oficial: altere o desenho em `components/logotipo.tsx` e em
`scripts/gerar-icones.mjs` e corra `node scripts/gerar-icones.mjs`.

## 11) Decisões tomadas

- **Custo/hora numa tabela própria** (`colaboradores_custos`) que só o gerente vê: a lista de
  colaboradores é visível a todos, os custos não.
- **Colaboradores sem acesso a clientes e locais** até à fase 2 (aí passam a ver só os dos seus
  trabalhos). Os chefes de equipa podem criar e alterar clientes e locais, mas não apagar.
- **Contas criadas pelo gerente**, sem registo público: o gerente define uma palavra-passe
  provisória, entrega-a à pessoa e esta muda-a no Perfil. A ficha do colaborador é separada da
  conta (há colaboradores sem conta) e retirar o acesso não apaga a ficha.
- **Tem de existir sempre um gerente ativo** (regra na base de dados).
- **NIF validado com o dígito de controlo** e único; código postal `0000-000`; telefones portugueses.
- **Desativar em vez de apagar:** os colaboradores só se desativam (mantêm o histórico); os clientes
  e locais podem ser apagados pelo gerente, mas recomenda-se desativá-los quando já tiverem
  trabalhos.
- **Um chefe só vê as ausências da equipa enquanto tiver o perfil de chefe**; ao mudar o perfil de
  um chefe, a app tira-o de chefe das equipas que chefiava.
- **Locais com coordenadas opcionais** (latitude e longitude, ambas ou nenhuma) para abrir o
  caminho no Google Maps ou no Waze.
- **Componentes shadcn/ui escritos à mão** em `components/ui` (sem a ferramenta da linha de comandos).
- **Cache Components ativo e dados sempre lidos no pedido** (`connection()`): nunca há dados de um
  utilizador guardados em cache partilhada. O service worker também nunca guarda páginas com dados.
- **Região Paris** (Supabase eu-west-3 e Vercel cdg1): perto de Portugal e dentro da UE (RGPD).
- **Fase 2 — trabalhos:** um trabalho é uma visita marcada para um dia, um local e uma equipa; o
  cliente vem do local. A ordem no dia é a ordem de passagem (servirá às rotas da fase 6). Os
  trabalhos que se repetem são criados todos de uma vez (até 1 ano) e ficam ligados como série, para
  se poder alterar ou apagar “este e os seguintes”. Só se apagam trabalhos agendados sem registos;
  os outros cancelam-se.
- **Fase 2 — colaborador:** vê só os trabalhos de hoje da sua equipa e os clientes/locais desses
  trabalhos, e só lhes pode mudar o estado (iniciar/concluir); no mapa de horas vê o nome dos
  trabalhos onde picou noutros dias, mas não os pode abrir.
- **Fase 2 — horas:** a picagem é feita por funções na base de dados com a hora do servidor (a hora
  do telemóvel não conta); mudar de trabalho fecha o período anterior; não há períodos sobrepostos;
  uma saída esquecida fecha às 23:59 desse dia e fica marcada “a rever” para o gerente. Horas extra:
  acima de 8 h por dia útil, e todas as horas em fins de semana e feriados nacionais (os feriados
  municipais não estão incluídos). O CSV usa `;` e vírgula decimal, para abrir bem no Excel português,
  e traz também os minutos exatos (o total em horas é calculado a partir deles).
- **Fase 2 — materiais:** registados como texto (descrição, quantidade, unidade); na fase 4 passam a
  ligar-se aos consumíveis e ao stock.
- **Fase 2 — fotos:** comprimidas no telemóvel antes de enviar; guardadas num espaço privado e
  mostradas com ligações temporárias (1 hora).
- **Fase 2 — trabalhos já começados:** um trabalho com horas, registo do dia ou fotos não muda de
  dia (as horas ficariam no dia errado) — cancela-se e cria-se outro; um trabalho com horas também
  não se apaga. Um trabalho novo (ou que muda de dia ou de equipa) entra na ordem do dia segundo a
  hora de início; depois, a ordem manual (arrastar ou ↑/↓) é a que conta.
- **Fase 2 — registo do dia:** se duas pessoas alterarem o mesmo registo ao mesmo tempo, a segunda a
  guardar é avisada e nada se perde. Uma assinatura do cliente, depois de feita, só pode ser
  substituída ou apagada pelo gerente ou pelo chefe. Nas quantidades dos materiais o ponto e a
  vírgula são ambos separadores decimais (`1.250` = 1,25).
- **Fase 2 — localização da picagem:** opcional (cada pessoa decide no seu telemóvel) e guardada com
  precisão de cerca de 11 m. Só o gerente a vê na app (ligação para o mapa e colunas no CSV).
- **Fase 2 — riscos aceites** (pouco prováveis, e a correção custaria mais do que evita; podem ser
  revistos mais tarde):
  - quem tem conta pode pedir à API do Supabase ligações temporárias mais longas para as fotos que
    já pode ver; a app usa sempre 1 hora;
  - o colaborador, pela API, consegue ler a ficha completa dos clientes dos seus trabalhos de hoje
    (NIF, email, morada de faturação), embora a app só lhe mostre o contacto;
  - o chefe, pela API, consegue ler a localização arredondada das picagens da sua equipa;
  - ficheiros enviados para o Storage sem foto associada ficam lá até serem apagados no painel
    (o limite de 3 MB por ficheiro reduz o impacto).
- **Português de Portugal** em toda a interface: datas `dd/mm/aaaa`, euros `1 234,56 €`, fuso
  horário de Lisboa.
- **A app não emite faturas.** Em Portugal as faturas têm de ser emitidas por software certificado
  pela AT. A app fica preparada para, numa fase futura, se integrar com um programa de faturação
  certificado (ex.: InvoiceXpress, Moloni ou Vendus).

## 12) Roteiro das fases

1. **Base** ✅ — login, perfis e permissões (RLS), menu para telemóvel e PC, clientes e locais,
   colaboradores, equipas e ausências, app instalável, dados de exemplo.
2. **Campo** ✅ — agenda/calendário por equipa, “O meu dia” para o colaborador, registo diário com
   fotos e materiais, picagem de horas.
3. **Orçamentos** — visitas com fotos, editor de orçamento, PDF com logótipo, conversão do orçamento
   aceite em trabalho.
4. **Recursos** — equipamentos e manutenções, consumíveis e stock ligado aos trabalhos.
5. **Dinheiro** — pagamentos, dívidas por cliente, contratos de manutenção recorrentes com geração
   automática de agendamentos e cobranças.
6. **Extras** — rotas do dia, obras com orçado vs. real, relatórios, calendário sazonal.
