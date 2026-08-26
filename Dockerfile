# ---------------------------------------------------------------
# Diagnóstico do Atendimento Comercial — imagem de produção
#
# O contexto de build é a RAIZ do repositório; a aplicação fica em
# diagnostico-comercial/. É assim que o EasyPanel monta por padrão.
#
# IMPORTANTE: as variáveis NEXT_PUBLIC_* entram no código durante a
# COMPILAÇÃO, não na hora de rodar. Elas precisam ser passadas como
# build args (no EasyPanel: aba Build > Build Arguments). As demais
# (senha do painel, planilha, webhook) são lidas em tempo de execução.
# ---------------------------------------------------------------

# ---------- 1. Dependências ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY diagnostico-comercial/package.json diagnostico-comercial/package-lock.json ./
RUN npm ci

# ---------- 2. Compilação ----------
FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_BRAND_NAME="Simplifica"
ARG NEXT_PUBLIC_CTA_URL=""
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_CTA_URL=$NEXT_PUBLIC_CTA_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY diagnostico-comercial/ ./
RUN npm run build

# ---------- 3. Execução ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Roda sem privilégios de root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pasta do armazenamento local de emergência (usada só se a planilha
# não estiver configurada). Sem isso a escrita falharia por permissão.
RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data

USER nextjs
EXPOSE 3000

# Verificação de saúde: a home precisa responder.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
