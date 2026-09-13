FROM node:24-bookworm-slim

ENV CI=true \
    PATH="/root/.local/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | bash -s -- -v 2.20.0

RUN curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/v0.63.0/scripts/install.sh | bash \
    && snfoundryup -v 0.63.0 \
    && sncast --version

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ops/package.json ./apps/ops/
COPY apps/web/package.json ./apps/web/
COPY circuits/package.json ./circuits/
COPY scripts/deploy_maci/package.json ./scripts/deploy_maci/

RUN pnpm install --frozen-lockfile --filter maci-ops...

COPY tsconfig.json Scarb.toml Scarb.lock ./
COPY common ./common
COPY contracts ./contracts
COPY apps/ops ./apps/ops
COPY scripts/deploy_maci ./scripts/deploy_maci

RUN chmod +x /repo/apps/ops/docker-entrypoint.sh \
    && scarb build --package maci_contracts

WORKDIR /repo/apps/ops

EXPOSE 8787

ENTRYPOINT ["./docker-entrypoint.sh"]
