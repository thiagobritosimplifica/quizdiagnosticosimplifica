# Diagnóstico do Atendimento Comercial — Simplifica

Landing page + quiz de 10 perguntas com pontuação automática, captura de leads,
resultado personalizado e painel administrativo protegido.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
**Google Sheets como banco de dados**.

---

## 1. Rodar localmente

```bash
cd diagnostico-comercial
npm install
npm run build
npm start
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin

Para mexer no código use `npm run dev` (sobe em http://localhost:3001, com recarga
automática, porém mais lento). Para testar a experiência real, use sempre `npm start`.

A senha do painel está em `.env.local` (`ADMIN_PASSWORD`). **Troque antes de publicar.**

Enquanto a planilha não estiver configurada, os leads caem em `.data/leads.json`.
O painel mostra no canto superior direito se está gravando em **Google Sheets** ou
em **Armazenamento local**.

---

## 2. Conectar a planilha do Google Sheets

A planilha é o banco de dados: o site grava os leads nela e o painel lê de lá.
A conversa acontece por um Web App do Apps Script, então **não precisa de conta de
serviço, chave de API nem projeto no Google Cloud**.

1. Abra a planilha que vai receber os leads.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do `Código.gs` e cole todo o arquivo
   [`google-sheets/Codigo.gs`](google-sheets/Codigo.gs).
4. Confirme que a linha `var SEGREDO = "...";` tem o **mesmo valor** de
   `SHEETS_SECRET` no `.env.local`. Ao colar o arquivo inteiro, essa linha vem
   junto — se os dois valores não baterem, toda chamada volta "Segredo inválido".
5. **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Autorize quando o Google pedir (vai aparecer um aviso de "app não verificado" —
   é o seu próprio script; clique em *Avançado → Acessar*).
7. Copie a URL gerada, que termina em `/exec`, e preencha o `.env.local`:

```bash
SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy.../exec
SHEETS_SECRET=o-mesmo-segredo-do-passo-4
```

8. Reinicie o servidor. O selo no painel deve mudar para **Google Sheets**.

> **Mudou o código do Apps Script depois?** Salvar não basta: a URL `/exec` continua
> servindo a versão publicada. Vá em Implantar → **Gerenciar implantações** → ícone de
> lápis → Versão: **Nova versão** → Implantar. A URL continua a mesma.

### Se algo não aparecer no painel

O script tem duas ações de manutenção, chamadas por POST na URL do Web App:

```bash
# mostra em qual planilha, aba e conta o script está mexendo
curl -L -X POST "$SHEETS_WEBAPP_URL" -H "Content-Type: text/plain"   -d '{"action":"diag","secret":"SEU_SEGREDO"}'

# reescreve a linha 1 com o cabeçalho correto, sem apagar leads
curl -L -X POST "$SHEETS_WEBAPP_URL" -H "Content-Type: text/plain"   -d '{"action":"arrumar-cabecalho","secret":"SEU_SEGREDO"}'

# apaga TODOS os leads e mantém o cabeçalho (para zerar dados de teste)
curl -L -X POST "$SHEETS_WEBAPP_URL" -H "Content-Type: text/plain"   -d '{"action":"limpar","secret":"SEU_SEGREDO","confirmar":"APAGAR TUDO"}'
```

A leitura dos leads é feita **por posição de coluna**, não pelo nome no cabeçalho.
Isso significa que renomear ou bagunçar a linha 1 não quebra o painel — mas também
que **inserir ou remover colunas no meio da planilha quebra**. Para anotações
próprias, use colunas depois da `_dados`.

### O que vai para a planilha

O cabeçalho é criado sozinho no primeiro lead. Uma linha por diagnóstico:

`ID · Data · Horário · Nome · WhatsApp · E-mail · Instagram · Cargo ·
Faturamento mensal · Pontuação · Resultado · P1…P10 (resposta e pontos) ·
UTM Source · UTM Medium · UTM Campaign · UTM Term · UTM Content · Referrer ·
created_at · _dados`

As duas últimas colunas são de uso interno: `created_at` guarda a data em formato
técnico (usada nos filtros) e `_dados` guarda as respostas em JSON, que é o que o
painel lê para montar o detalhe de cada lead. **Não apague nem renomeie essas
colunas.** As demais podem ser editadas à vontade — corrigir um nome na planilha
reflete no painel.

Pode compartilhar a planilha com quantas pessoas quiser: quem tem acesso a ela vê
os leads em tempo real, sem precisar entrar no painel.

---

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `ADMIN_PASSWORD` | sim | Senha de acesso ao `/admin` |
| `ADMIN_SESSION_SECRET` | sim | Assina o cookie de sessão (string aleatória longa) |
| `SHEETS_WEBAPP_URL` | sim, em produção | URL `/exec` do Web App do Apps Script |
| `SHEETS_SECRET` | sim, em produção | O mesmo `SEGREDO` definido no Apps Script |
| `NEXT_PUBLIC_BRAND_NAME` | não | Nome usado nos textos (padrão `Simplifica`) |
| `NEXT_PUBLIC_CTA_URL` | **sim, na prática** | Link do botão final. Hoje está com um número de exemplo — troque pelo WhatsApp real |
| `N8N_WEBHOOK_URL` | não | Webhook do n8n, no formato do Respondi (ver seção 6) |
| `LEAD_WEBHOOK_URL` | não | Webhook em formato nativo, para CRM/automação |
| `LEAD_WEBHOOK_SECRET` | não | Enviado no header `X-Webhook-Secret` |
| `WEBHOOK_FORM_NAME` | não | Nome do formulário no payload do webhook |
| `WEBHOOK_FORM_ID` | não | Identificador do formulário no payload |

Gerar um `ADMIN_SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Publicar

### EasyPanel (Docker)

O projeto já traz um [`Dockerfile`](../Dockerfile) em três estágios, gerando uma
imagem enxuta com a saída `standalone` do Next.js, rodando sem root e com
healthcheck na porta 3000.

O `Dockerfile` fica na **raiz do repositório** (não dentro de
`diagnostico-comercial/`), que é onde o EasyPanel procura por padrão.

No EasyPanel, crie um App do tipo **Dockerfile** apontando para o repositório:

| Campo | Valor |
|---|---|
| Build path / contexto | `/` (raiz do repositório) |
| Dockerfile | `Dockerfile` |
| Porta | `3000` |

**Build Arguments** (obrigatórios — entram no código na compilação):

```
NEXT_PUBLIC_BRAND_NAME=Simplifica
NEXT_PUBLIC_CTA_URL=https://wa.me/SEUNUMERO?text=...
```

**Environment Variables** (lidas ao rodar):

```
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
SHEETS_WEBAPP_URL=...
SHEETS_SECRET=...
N8N_WEBHOOK_URL=...
```

> A diferença entre as duas listas importa: trocar `NEXT_PUBLIC_CTA_URL` exige
> **rebuild** da imagem, não só reiniciar o contêiner. As demais valem no restart.

Construir a imagem localmente, se quiser testar antes:

```bash
# a partir da raiz do repositório
docker build -t diagnostico-comercial --build-arg NEXT_PUBLIC_CTA_URL="https://wa.me/SEUNUMERO" .
```

### Vercel

Alternativa sem Docker: importe o repositório, defina o Root Directory como
`diagnostico-comercial` e cadastre as mesmas variáveis em
**Settings → Environment Variables**.

Como o armazenamento é a planilha, não há banco para provisionar. O fallback
`.data/leads.json` **não funciona em produção** (sistema de arquivos efêmero),
então `SHEETS_WEBAPP_URL` precisa estar preenchida.

---

## 5. Painel administrativo

`/admin` — protegido por senha, com cookie de sessão assinado (HMAC-SHA256, 12h),
`httpOnly`, `secure` em produção. As rotas `/api/admin/*` recusam qualquer
requisição sem sessão válida (401), e o login tem limite de 6 tentativas por minuto.

- **Indicadores:** total de diagnósticos, total de leads (e-mails únicos),
  média de pontuação e o percentual de cada uma das 4 classificações.
- **Filtros:** busca por nome/e-mail/WhatsApp/Instagram, resultado, faixa de
  pontuação, período, cargo e faixa de faturamento. Os indicadores recalculam junto.
- **Tabela:** Nome · WhatsApp · E-mail · Cargo · Faturamento · Pontuação · Resultado · Data.
- **Respostas:** cada linha expande com as 10 perguntas, a resposta escolhida,
  os pontos, o Instagram clicável e a origem do tráfego.
- **Exportar leads:** CSV com 37 colunas, respeitando os filtros ativos.
  Separador `;` e BOM UTF-8 — abre direto no Excel.

A leitura da planilha fica em cache por 15 segundos, para o painel não ficar lento
ao trocar de filtro. Um lead novo limpa o cache na hora.

---

## 6. Integrações

### n8n (formato Respondi)

`N8N_WEBHOOK_URL` recebe um `POST` com a **mesma estrutura que o Respondi envia**,
para reaproveitar fluxos já montados no n8n:

```json
{
  "form": { "form_name": "...", "form_id": "..." },
  "respondent": {
    "status": "completed",
    "date": "2026-08-26 12:00:12",
    "score": 38,
    "respondent_id": "uuid do lead",
    "answers": { "<título da pergunta>": "<resposta>" },
    "raw_answers": [ { "question": { "question_title", "question_id", "question_type" }, "answer" } ],
    "respondent_utms": { "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid" }
  },
  "diagnostico": { "score", "max_score", "tier_id", "tier_label", "respostas", "referrer" }
}
```

Os `question_id` são estáveis — mapeie por eles, não pelo título:

| `question_id` | Campo |
|---|---|
| `nome` | Nome (texto) |
| `telefone` | WhatsApp — `{ "country": "55", "phone": "31985181164" }` |
| `email` | E-mail |
| `instagram` | Instagram |
| `cargo` | Cargo (array com um item) |
| `faturamento` | Faturamento (array com um item) |
| `p1` … `p10` | As 10 perguntas do diagnóstico (array com um item) |

O bloco `diagnostico` é um extra fora do formato do Respondi, com a pontuação,
a classificação e as 10 respostas detalhadas com os pontos de cada uma.

O nome do formulário pode ser trocado com `WEBHOOK_FORM_NAME` e `WEBHOOK_FORM_ID`.

### Outros destinos

`LEAD_WEBHOOK_URL` recebe um payload nativo, mais simples
(`{ event, source, sent_at, lead }`), para CRM, Make/Zapier ou automação de
marketing. As duas variáveis aceitam **várias URLs separadas por vírgula**.

Os envios acontecem depois que a pessoa já viu o resultado, com uma segunda
tentativa em caso de falha. Nada disso derruba o cadastro do lead nem a
gravação na planilha — erros só vão para o log.

**Meta Ads / Google Ads:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`,
`utm_content`, além de `gclid` e `fbclid`, são capturados da URL automaticamente.
Os UTMs vão para a planilha e para os webhooks; `gclid` e `fbclid` vão apenas
para os webhooks, por serem úteis em tempo real na atribuição de anúncios.

---

## 7. Como a pontuação funciona

Cada pergunta vale de 1 a 4 pontos — mínimo 10, máximo 40.
A pontuação é **sempre recalculada no servidor**; o valor enviado pelo navegador
é ignorado.

| Faixa | Classificação |
|---|---|
| 10–19 | 🚨 Atendimento vazando vendas |
| 20–29 | ⚠️ Atendimento reativo |
| 30–36 | 📈 Atendimento comercial estruturado |
| 37–40 | 🔥 Máquina comercial |

Perguntas e pontos: [`lib/questions.ts`](lib/questions.ts).
Textos e faixas dos resultados: [`lib/scoring.ts`](lib/scoring.ts).
Cargos e faixas de faturamento: [`lib/profile.ts`](lib/profile.ts).

---

## 8. Identidade visual

Tema Aurora, definido em [`app/globals.css`](app/globals.css):

| Uso | Cor |
|---|---|
| Fundo | `#070B16` |
| Navy (superfícies) | `#0B1124` |
| Primário (botões, progresso) | `#5A7CFF` |
| Acento (ícones, links) | `#7F9BFF` |
| Azul escuro (início dos gradientes) | `#4A6EDC` |
| Acento claro | `#9DB2FF` |
| Texto forte | `#F2F5FC` |
| Texto corrido | `#CDD5E6` |
| Texto apagado | `#79839C` |
| Texto tênue | `#6B7690` |

Logo em `public/logo-simplifica.png`, usada pelo componente `BrandMark`.

---

## 9. Estrutura do projeto

```
app/
  page.tsx                  Landing + quiz (client)
  admin/page.tsx            Painel (protegido)
  admin/login/page.tsx      Login
  api/leads/route.ts        Recebe o diagnóstico e grava na planilha
  api/admin/login|logout    Sessão do painel
  api/admin/leads           Lista + indicadores (filtros)
  api/admin/export          Exportação CSV
components/
  Diagnostico.tsx           Hero → quiz → captura → resultado
  AdminDashboard.tsx        Painel
  ScoreGauge.tsx            Medidor animado da pontuação
  BrandMark.tsx             Logo
lib/
  questions.ts scoring.ts   Regras do diagnóstico
  profile.ts                Cargo e faturamento
  db.ts                     Google Sheets (ou arquivo local em dev)
  auth.ts validation.ts     Sessão e validações
  integrations.ts           Envio para n8n e outros webhooks
  webhook-payload.ts        Payload no formato do Respondi
google-sheets/
  Codigo.gs                 API da planilha (Apps Script)
```
