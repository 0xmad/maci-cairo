# Postgres stores jobs; CLI stand-up stays unchanged

Ops persists the current stand-up job, its step log, and current MACI in
Postgres (`DATABASE_URL`, Compose, migrations on boot). The CLI in
`scripts/deploy_maci` still prints the stdout record and is what `make deploy`
smokes; it does not read Postgres. The backend calls the same TypeScript
`deployMaci` function as the CLI, with injected sncast ops and no coordinator
override.

We rejected a deployments JSON catalog, Last-Event-ID, and changing CLI stdout
to carry job state. Failed or interrupted stand-up leaves a Postgres checkpoint
of instance addresses; Start stand-up resumes that graph and skips
`deployUnique` for stored addresses; declare may run again if a class hash is
missing. Discard when idle drops the checkpoint and does not clean the chain.
Current MACI is recorded only after `set_target` and the coordinator check
succeed. A backend restart marks any still-running job interrupted.
