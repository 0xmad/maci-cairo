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

Connect uses injected Argent or Braavos. There is no paymaster. Create Poll is not wired. MACI stand-up is a server job started from Deploy after Operator sign-in.

## Networks

`VITE_RPC_URL` and `VITE_NETWORK_ID` set the default (local `5050` or `sepolia`). In `pnpm dev`, loopback `5050` is served as `/starknet-rpc` and loopback `8787` as `/ops` so the browser is not blocked by CORS. The switcher's Sepolia option is disabled for now. Switching network asks the connected wallet for `wallet_switchStarknetChain`, then disconnects and signs the Operator out (clears `maci.operator.jwt`). A MACI address in the URL is kept and noted as network-specific.

## Scaffold note

`create-starkzap-app` is interactive-only. This package is a Vite + React + Tailwind + StarkZap app in the pnpm workspace, without the template's DeFi, Privy, or paymaster chrome.
