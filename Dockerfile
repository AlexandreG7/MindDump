FROM node:20-alpine AS base
RUN apk add --no-cache openssl

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SKIP_AUTH
ENV NEXT_PUBLIC_SKIP_AUTH=${NEXT_PUBLIC_SKIP_AUTH}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# pg_dump pour la sauvegarde automatique avant migration (entrypoint.sh).
# Version = celle du serveur PostgreSQL (postgres:16 dans docker-compose.yml).
RUN apk add --no-cache postgresql16-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Images envoyées par les utilisateurs : monter un volume persistant ici.
ENV UPLOAD_DIR=/app/data/uploads
# Sauvegardes de la base avant migration : monter aussi un volume persistant ici.
ENV BACKUP_DIR=/app/data/backups
RUN mkdir -p /app/data/uploads /app/data/backups && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./entrypoint.sh"]
