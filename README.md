# Empadas da Lia — Sistema de Pedidos (WhatsApp)

Sistema simples (MVP) para vitrine de empadas + carrinho + checkout, com envio do pedido via WhatsApp.

> Objetivo: funcionar como “mini iFood” no fluxo e na UX, mas sem gateway de pagamento e sem backend de pedidos (o pedido é gerado e enviado para o WhatsApp).

## Stack / Tecnologias

- **Frontend**: React 19 + TypeScript (`client/`)
- **Build/Dev server**: Vite 7 (`vite.config.ts:1`)
- **UI**: Tailwind CSS v4 (via `@tailwindcss/vite`), Radix UI/shadcn-style components
- **Router**: `wouter` (SPA)
- **Backend (somente para servir build local/produção fora do Netlify)**: Express (`server/index.ts:1`)
- **Gerenciador de pacotes**: pnpm (`package.json:1`)

## Como rodar localmente

Pré-requisitos:
- Node.js **20+**
- pnpm (recomendado pela config do repo)

Comandos:
- Instalar: `pnpm install`
- Desenvolvimento (porta 3000): `pnpm dev`
  - Configuração do Vite define `port: 3000` (`vite.config.ts:1`)
- Typecheck: `pnpm check`
- Build: `pnpm build`
- Preview do build (servidor do Vite): `pnpm preview`
- Rodar build com Express (modo “produção” local): `pnpm build` e depois `pnpm start`
- Testar Admin + API local (Netlify Dev, porta 8888):
  - `pnpm netlify:dev` (ou `pnpm netlify dev`)
  - Abrir: `http://localhost:8888/admin/login`
  - **Na mesma rede (tablet/celular):** `pnpm netlify:lan` e abrir `http://SEU-IP:8888/admin/login`
  - Observação: `pnpm dev` (porta 3000) roda **apenas o frontend** (sem `/api/*`), então o login do Admin não funciona lá.
  - Para o Admin funcionar localmente, crie `.env` ou `.env.local` (use `.env.example` como base).
  - No Windows, garanta que o arquivo esteja salvo como **UTF-8** (evita problemas se o editor salvar em UTF-16).

## Estrutura do projeto

- `client/`: aplicação React (SPA)
  - `client/index.html`: HTML base, meta tags, favicon
  - `client/src/main.tsx`: bootstrap do React + analytics opcional (`client/src/main.tsx:1`)
  - `client/src/App.tsx`: providers + rotas (`client/src/App.tsx:1`)
  - `client/src/pages/Home.tsx`: vitrine + carrinho/checkout (`client/src/pages/Home.tsx:1`)
- `shared/`: constantes compartilhadas (catálogo, WhatsApp, etc.)
  - `shared/const.ts`: **fonte do catálogo** (`shared/const.ts:1`)
- `server/`: Express para servir o build localmente/produção fora do Netlify (`server/index.ts:1`)
- `dist/public`: saída do build do frontend (gerado)

Aliases importantes (Vite + TS):
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
(`vite.config.ts:1`, `tsconfig.json:1`)

## Catálogo de produtos (sabores, preço, imagens)

O catálogo fica em `shared/const.ts:1`, exportado para o frontend via `client/src/const.ts:1`.

Cada produto tem:
- `id`: identificador único (ex: `empada-frango`)
- `name`, `description`
- `price`: número (hoje, padrão `10`)
- `image`: caminho público (ex: `/images/products/empada-frango.jpg`)
- `category`: `classic | premium | vegetarian | all` (usado no filtro)
- `availability`: `"available"` ou `"on_demand"`

### Onde colocar as fotos

Coloque as fotos aqui:
- `client/public/images/products/`

Padrão de nomes (igual ao `id`):
- `empada-frango.jpg`
- `empada-palmito.jpg`
- `empada-camarao.jpg`
- `empada-queijo.jpg`
- `empada-cogumelo.jpg`
- `empada-carne.jpg`

Guia rápido: `client/public/images/products/README.md:1`

Fallback:
- Se a imagem não existir, o card cai para `/images/empada-close-up.jpg` (`client/src/components/ProductCard.tsx:1`).

## Disponibilidade: “Disponível” vs “Sob demanda”

Você controla isso em `shared/const.ts:1`:
- `availability: "available"` → aparece botão **Adicionar** (vai para o carrinho)
- `availability: "on_demand"` → aparece selo **Sob demanda** + botão **Solicitar**
  - Esse botão abre WhatsApp com mensagem pronta de solicitação (`client/src/lib/whatsappUtils.ts:1`).
- `availability: "unavailable"` → aparece selo **Indisponível** + botão **Consultar** (WhatsApp)

### Ajustar preço/status pelo Admin (Drive)

No painel:
- Local (Netlify Dev): `http://localhost:8888/admin/products`
- Produção: `https://<seu-site>.netlify.app/admin/products`

Você consegue:
- alterar **preço** por sabor
- marcar o sabor como **Disponível / Sob demanda / Indisponível**

Essas mudanças são salvas no Drive (em `GOOGLE_DRIVE_ADMIN_FOLDER_ID`) e a vitrine pública passa a refletir automaticamente.

## Carrinho (estado e persistência)

- Hook: `client/src/hooks/useCart.ts:1`
- Persistência: `localStorage` em `CART_STORAGE_KEY = "empadas-cart"`
- Motivo técnico: o estado é sincronizado com `useSyncExternalStore` para que **Home** e **CartDrawer** enxerguem o mesmo carrinho, sem “ficar vazio”.

Operações:
- `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `getTotalQuantity`

## Checkout (entrega e pagamento)

Tela do carrinho/checkout:
- `client/src/components/CartDrawer.tsx:1`

Campos e regras:
- Nome + Telefone: obrigatórios
- Entrega:
  - `Entregar`: endereço obrigatório
  - `Em mãos (eu mesmo levo)`: endereço vira “Local/Referência (opcional)”
- Pagamento:
  - `PIX`, `Dinheiro`, `Cartão`

Configuração opcional de PIX:
- `PIX_KEY` em `shared/const.ts:1` (se preenchido, vai na mensagem do pedido quando o pagamento for PIX).

## Integração WhatsApp (pedido e solicitação sob demanda)

Biblioteca de mensagem/URL:
- `client/src/lib/whatsappUtils.ts:1`

Fluxos:
- **Pedido normal**: gera mensagem + abre `https://wa.me/<numero>?text=...`
- **Sob demanda**: gera mensagem curta pedindo disponibilidade/prazo

Número do WhatsApp:
- `WHATSAPP_NUMBER` em `shared/const.ts:1`

## Estilo/tema (“cara de iFood” com toque da marca)

- Tailwind v4 sem `tailwind.config.*` (tokens via CSS)
- Tokens e paleta em `client/src/index.css:1`
  - Primária (vermelho estilo iFood): `--primary`
  - Dourado como assinatura/realce: `--color-gold`

## Analytics (opcional)

Carregamento condicional de script (ex: Umami):
- `client/src/lib/analytics.ts:1`

Variáveis:
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`

Se não estiverem definidas, o script não é carregado.

## Deploy no Netlify (GitHub)

Este projeto é **SPA estática** no Netlify.

Config já preparada:
- `netlify.toml:1`
  - build: `pnpm build`
  - publish: `dist/public`
  - redirect: `/api/*` → `/.netlify/functions/api/:splat` (backend)
  - redirect: `/*` → `/index.html` (necessário para rotas SPA)

Notas:
- O Express (`server/index.ts:1`) **não roda no Netlify** (a menos que você migre para Netlify Functions).

## Backend (Netlify Function `api`) — Express + tRPC + Zod + Drive

O backend roda como **uma única Netlify Function**:
- Código: `netlify/functions/api.ts:1` → `src/api.ts:1` → `src/index.ts:1`
- Base URL (Netlify): `https://<seu-site>.netlify.app/api`
- tRPC endpoint: `/api/trpc`

### Variáveis de ambiente (Netlify)

Obrigatórias:
- `JWT_SECRET`: segredo do JWT (ex: 32+ caracteres)
- `ADMIN_USERNAME`: usuário do admin
- `ADMIN_PASSWORD`: senha do admin
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`: JSON da service account em base64
- `GOOGLE_DRIVE_ADMIN_FOLDER_ID`: pasta raiz no Drive para dados do admin/financeiro

Padronizadas (podem ser usadas futuramente):
- `GOOGLE_DRIVE_QUOTES_FOLDER_ID`
- `GOOGLE_DRIVE_IMAGES_FOLDER_ID`

### Autenticação (admin)

- `auth.login` valida `ADMIN_USERNAME/ADMIN_PASSWORD`
- Se OK, cria um JWT e grava cookie `admin_session` como `httpOnly` (`SameSite=Lax`, `Secure` em produção)
- `auth.me` retorna `role=admin` quando o cookie é válido

Arquivos:
- Cookie/JWT/context: `src/context.ts:1`
- Router auth: `src/routers.ts:1`

### Persistência “Drive-first” (JSON)

Financeiro é persistido no Google Drive (service account) como **JSON por registro** em subpastas dentro de `GOOGLE_DRIVE_ADMIN_FOLDER_ID`:

- `finance_categories/<id>.json`
- `finance_transactions/<id>.json`
- `finance_accounts/<id>.json`

Arquivos:
- Drive client: `src/driveClient.ts:1`
- Store genérico por registro: `src/driveEntityStore.ts:1`

Observação: se o ambiente não tiver permissão para **criar pastas** no Drive, o backend faz fallback e salva na pasta raiz usando prefixos:
- `finance_categories__<id>.json`
- `finance_transactions__<id>.json`
- `finance_accounts__<id>.json`

#### Local (dev): fallback automático para arquivos no PC

Se o Google Drive retornar o erro **“Service Accounts do not have storage quota”** durante `pnpm netlify:dev`, o backend faz fallback automático e salva os JSONs localmente em:
- `.local-data/`

Isso permite testar o painel localmente mesmo sem escrita no Drive. Em produção (Netlify) a persistência deve ser no Drive.

### Domínio Financeiro (tRPC)

Router raiz: `src/routers.ts:1` (`finance.*` exige admin)

- `finance.categories.*`: list/create/update/delete
- `finance.transactions.*`: list/create/update/delete/confirm/export.csv
- `finance.accounts.*`: list/create/update/delete/pay
- `finance.dashboard.summary(from,to)`: totais por período (CONFIRMED)

CSV:
- Procedimento tRPC: `finance.transactions.export.csv` (retorna `{ csv }`)
- Endpoint direto (texto/csv): `GET /api/finance/transactions/export.csv?from=...&to=...` (`src/index.ts:1`)

### Smoke tests (rápidos)

Substitua `<SITE>` por sua URL do Netlify (ex: `https://lia-empadas.netlify.app`).

1) Verificar que está protegido:

`GET /api/trpc/auth.me` → 401

```bash
curl -i "<SITE>/api/trpc/auth.me"
```

2) Login (gera cookie):

```bash
curl -i -c cookies.txt \
  -H "content-type: application/json" \
  -d '{"username":"'"$ADMIN_USERNAME"'","password":"'"$ADMIN_PASSWORD"'"}' \
  "<SITE>/api/trpc/auth.login"
```

3) Confirmar admin:

```bash
curl -i -b cookies.txt "<SITE>/api/trpc/auth.me"
```

4) Criar uma categoria:

```bash
curl -i -b cookies.txt \
  -H "content-type: application/json" \
  -d '{"name":"Vendas","kind":"IN"}' \
  "<SITE>/api/trpc/finance.categories.create"
```

5) Criar um lançamento:

Troque `CATEGORY_ID` pelo `id` retornado na categoria.

```bash
curl -i -b cookies.txt \
  -H "content-type: application/json" \
  -d '{"type":"IN","dateISO":"2026-02-11","amount":10,"categoryId":"CATEGORY_ID","paymentMethod":"PIX","description":"Venda balcão","source":"manual"}' \
  "<SITE>/api/trpc/finance.transactions.create"
```

6) Export CSV (download):

```bash
curl -i -b cookies.txt "<SITE>/api/finance/transactions/export.csv"
```

7) Verificar no Drive (manual):

- Abra a pasta do Drive informada em `GOOGLE_DRIVE_ADMIN_FOLDER_ID`
- Entre em `finance_transactions/`
- Deve existir um arquivo `<id>.json` referente ao lançamento criado

Observação: para mutations tRPC use `POST /api/trpc/<procedure>` com body JSON sendo o input direto (ex: `{"username":"...","password":"..."}`); para queries use `GET /api/trpc/<procedure>?input=<json-url-encoded>`.

## Debug logs (.manus-logs)

Em desenvolvimento, o Vite usa um plugin que coleta logs do browser e escreve em `.manus-logs/` (`vite.config.ts:1`).
Essa pasta é ignorada no Git (`.gitignore:1`).

## “Fim a fim” do pedido (resumo)

1. Usuário escolhe sabor e quantidade → **Adicionar**
2. Item vai para `localStorage` (store do carrinho)
3. Usuário abre carrinho → revisa itens e quantidades
4. Usuário finaliza → escolhe entrega + pagamento + preenche dados
5. App gera mensagem → abre WhatsApp com texto pronto
