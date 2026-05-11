# Build context = repo root (web3nity-students/).
FROM node:20-alpine
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
