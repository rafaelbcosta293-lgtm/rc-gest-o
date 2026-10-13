# Fatijardins

Aplicação de gestão interna da **Fatijardins**, empresa de manutenção e construção de jardins.
Serve para organizar a **equipa**, os **clientes** e os **locais** onde se trabalha. Foi pensada
primeiro para o **telemóvel** (pode ser instalada como uma app) e funciona também no **PC**.

> **Estado:** fase 1 (Base) concluída. Ver o [roteiro](#12-roteiro-das-fases) no fim.

**Índice:** [O que faz](#o-que-a-app-faz-fase-1) ·
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
[11) Decisões](#11-decisões-tomadas-na-fase-1) ·
[12) Roteiro](#12-roteiro-das-fases)

---

## O que a app faz (fase 1)

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
│   ├── (app)/                Páginas com sessão iniciada (menu, Início, Clientes, Equipa, Perfil)
│   │   ├── clientes/         Clientes e os seus locais (+ acoes.ts: gravar na base de dados)
│   │   ├── equipa/           Colaboradores, equipas, ausências e acessos (+ acoes.ts)
│   │   └── perfil/           Dados da conta e mudar palavra-passe
│   ├── auth/confirm/         Destino das ligações enviadas por email
│   ├── offline/              Página “Sem ligação à internet”
│   ├── manifest.ts           Manifesto da app instalável (/manifest.webmanifest)
│   ├── favicon.ico, icon.svg, apple-icon.png   Ícones do browser e do iPhone
│   └── layout.tsx            Estrutura comum a todas as páginas
├── components/               Peças reutilizáveis (cabeçalho, logótipo, menu…)
│   └── ui/                   Botões, campos, cartões, diálogos (shadcn/ui)
├── hooks/                    use-acao-formulario.ts (envio de formulários)
├── lib/                      Lógica partilhada
│   ├── supabase/             Ligação ao Supabase e tipos da base de dados
│   ├── validacao/            Regras dos formulários (NIF, código postal, telefone…)
│   ├── auth.ts, perfis.ts    Sessão e perfis
│   └── formatar.ts           Datas, euros e áreas no formato português
├── public/
│   ├── icons/                Ícones da app instalada
│   └── sw.js                 Service worker (página offline e cache de ficheiros estáticos)
├── scripts/gerar-icones.mjs  Volta a gerar os ícones a partir do símbolo
├── supabase/
│   ├── migrations/           SQL que cria as tabelas e as permissões (por ordem de data)
│   ├── seed.sql              Dados de exemplo (contas demo, equipas, clientes, locais)
│   └── tests/rls_fase1.sql   Testes das permissões
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
| Criar, alterar e apagar colaboradores e equipas | ✅ | — | — |
| Ver e alterar o custo/hora dos colaboradores | ✅ | — | — |
| Ver ausências | todas | as da sua equipa | só as suas |
| Marcar e apagar ausências | ✅ | — | — |
| Ver, criar e alterar clientes e locais | ✅ | ✅ | — (fase 2) |
| Apagar clientes e locais | ✅ | — | — |
| Criar acessos, repor palavras-passe, retirar acessos | ✅ | — | — |
| Mudar a própria palavra-passe | ✅ | ✅ | ✅ |

**Onde são aplicadas** (do mais importante para o menos importante):

1. **Na base de dados — Row Level Security (RLS).** É a proteção real: as regras estão em
   `supabase/migrations/…_fase1_base.sql` e o PostgreSQL recusa ler ou gravar o que o perfil não
   permite, venha o pedido de onde vier. Uma conta sem colaborador ativo não vê nada. Um gatilho
   impede que fique sem nenhum gerente ativo.
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
região **eu-west-3 (Paris)**, com a migração e os dados de exemplo já aplicados. O endereço é
`https://iodjvvtumuhlvdsemhbb.supabase.co`. Se vai usar este projeto, passe ao
[passo 4](#4-configurar-a-autenticação-no-painel-do-supabase).

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

### Dados de exemplo

Para experimentar a app, cole o conteúdo de `supabase/seed.sql` no **SQL Editor** e clique **Run**.
Cria 2 equipas, 7 colaboradores, 8 clientes, 12 locais e estas contas, todas com a palavra-passe
**`Fatijardins2026!`**:

| Email | Nome | Perfil | Equipa |
| --- | --- | --- | --- |
| gerente@example.com | Marta Fonseca | Gerente | — |
| chefe.verde@example.com | Rui Carvalho | Chefe de equipa | Equipa Verde |
| chefe.terra@example.com | Sofia Lopes | Chefe de equipa | Equipa Terra |
| tiago@example.com | Tiago Mendes | Colaborador | Equipa Verde |
| nuno@example.com | Nuno Pires | Colaborador | Equipa Verde |
| ines@example.com | Inês Rocha | Colaboradora | Equipa Terra |

(O Jorge Dias, da Equipa Terra, é um colaborador **sem** conta de acesso.)

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
>    (Em alternativa, em cada colaborador: **Acesso à app → Retirar acesso**. Apagar no painel em
>    *Authentication → Users* uma conta ligada a um colaborador pode dar o erro
>    “Database error deleting user”.)
> 4. Na app, apague ou desative os colaboradores, equipas e clientes de exemplo.

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

Com os dados de exemplo carregados, cole `supabase/tests/rls_fase1.sql` no **SQL Editor** e clique
**Run**. O teste corre dentro de uma transação e desfaz tudo no fim (*rollback*), por isso **não
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

## 11) Decisões tomadas na fase 1

- **Custo/hora numa tabela própria** (`colaboradores_custos`) que só o gerente vê: a lista de
  colaboradores é visível a todos, os custos não.
- **Colaboradores sem acesso a clientes e locais** até à fase 2 (aí passam a ver só os dos seus
  trabalhos). Os chefes de equipa podem criar e alterar clientes e locais, mas não apagar.
- **Contas criadas pelo gerente**, sem registo público: o gerente define uma palavra-passe
  provisória, entrega-a à pessoa e esta muda-a no Perfil. A ficha do colaborador é separada da
  conta (há colaboradores sem conta) e retirar o acesso não apaga a ficha.
- **Tem de existir sempre um gerente ativo** (regra na base de dados).
- **NIF validado com o dígito de controlo** e único; código postal `0000-000`; telefones portugueses.
- **Desativar em vez de apagar** clientes e colaboradores, para manter o histórico.
- **Locais com coordenadas opcionais** (latitude e longitude, ambas ou nenhuma) para abrir o
  caminho no Google Maps ou no Waze.
- **Componentes shadcn/ui escritos à mão** em `components/ui` (sem a ferramenta da linha de comandos).
- **Cache Components ativo e dados sempre lidos no pedido** (`connection()`): nunca há dados de um
  utilizador guardados em cache partilhada. O service worker também nunca guarda páginas com dados.
- **Região Paris** (Supabase eu-west-3 e Vercel cdg1): perto de Portugal e dentro da UE (RGPD).
- **Português de Portugal** em toda a interface: datas `dd/mm/aaaa`, euros `1 234,56 €`, fuso
  horário de Lisboa.
- **A app não emite faturas.** Em Portugal as faturas têm de ser emitidas por software certificado
  pela AT. A app fica preparada para, numa fase futura, se integrar com um programa de faturação
  certificado (ex.: InvoiceXpress, Moloni ou Vendus).

## 12) Roteiro das fases

1. **Base** ✅ — contas, perfis e permissões, equipa, ausências, clientes e locais, app instalável.
2. **Campo** — agenda dos trabalhos por equipa e registo do que se fez no local (horas, notas, fotos).
3. **Orçamentos** — preparar e enviar orçamentos aos clientes e acompanhar a sua aceitação.
4. **Recursos** — materiais, viaturas e equipamentos usados em cada trabalho.
5. **Dinheiro** — custos e rentabilidade por cliente e trabalho, ligação à faturação certificada.
6. **Extras** — notificações, relatórios e outras melhorias pedidas pela equipa.
