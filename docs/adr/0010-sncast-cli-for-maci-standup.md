# sncast CLI stands up a local MACI

MACI stand-up (FreeForAll Policy, constant vote-balance assigner, declare Poll
and PollFactory, construct MACI, Enforcer `set_target`) is a TypeScript package
in `scripts/deploy_maci` that runs `sncast declare` / `deploy` / `invoke` /
`call` against `starknet-devnet --seed 0` as `devnet-1`. Foundry 0.63.0 removed
Cairo `sncast script` and `sncast_std`, so we use the CLI the binary still
ships. The Enforcer constructor takes an explicit owner because `sncast deploy`
goes through the Universal Deployer Contract, which would otherwise become
owner. Stdout is the record. CI smokes `make deploy` on an ephemeral node. We
rejected Node codegen of calldata, a deployments JSON, wiring the web Deploy
page, creating Polls, other policies, and Sepolia. Poll creation stays
Coordinator-only (ADR-0009).
