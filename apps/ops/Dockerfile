FROM node:24-bookworm-slim

ENV CI=true

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ops/package.json ./apps/ops/
COPY apps/web/package.json ./apps/web/
COPY circuits/package.json ./circuits/
COPY scripts/deploy_maci/package.json ./scripts/deploy_maci/

RUN pnpm install --frozen-lockfile --filter maci-ops...

COPY tsconfig.json ./
COPY apps/ops ./apps/ops

WORKDIR /repo/apps/ops

EXPOSE 8787

CMD ["pnpm", "start"]
