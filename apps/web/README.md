# MACI ops console (`maci-web`)

Developer scaffold for coordinator **ops**: deploy a MACI (not a Coordinator call), then later `create_poll`. Signup is out of scope. Tally may be added later and is not Coordinator-gated.

## Run

From the repository root:

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
pnpm --filter maci-web dev
```

Or `make types-web` / `make test-web` / `make test-web-coverage`.

Connect uses injected Argent or Braavos. There is no paymaster. Deploy and Create Poll are not wired.

## Networks

`VITE_RPC_URL` and `VITE_NETWORK_ID` set the default (local `5050` or `sepolia`). The switcher also uses `VITE_SEPOLIA_RPC_URL`. Switching network keeps a MACI address in the URL and notes that addresses are network-specific.

## Scaffold note

`create-starkzap-app` is interactive-only. This package is a Vite + React + Tailwind + StarkZap app in the pnpm workspace, without the template's DeFi, Privy, or paymaster chrome.
