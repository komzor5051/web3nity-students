# Build context = repo root (web3nity-students/).
# Node 22: нужен нативный WebSocket для @supabase/supabase-js realtime-клиента.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/parser/package.json packages/parser/package.json

RUN npm install --workspaces --include-workspace-root --omit=dev || npm install --workspaces --include-workspace-root

COPY packages ./packages
COPY apps/bot ./apps/bot

WORKDIR /app/apps/bot
CMD ["npx", "tsx", "src/index.ts"]
