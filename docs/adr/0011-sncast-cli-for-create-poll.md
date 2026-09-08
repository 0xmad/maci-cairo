# sncast CLI creates a local Poll from JSON intent

Coordinator `create_poll` against an already-stood-up seed-0 MACI is a second
entry in `scripts/deploy_maci`, not part of `make deploy`. Intent is a strict
JSON file passed as `--config` (`maci` plus `CreatePollArgs`; no poll id). Stdout
is the record (`maci`, `poll`, `poll_id` from `IPoll.poll_id`). The caller is
seed-0 `devnet-1`; we preflight coordinator and state-tree depth. We rejected
folding create into MACI stand-up, a deployments JSON, caller-chosen poll ids,
account switching, and Sepolia. Poll creation stays Coordinator-only (ADR-0009);
stand-up stays Poll-less (ADR-0010).
