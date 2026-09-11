# Postgres stores jobs; CLI stand-up stays unchanged

Ops persists the current stand-up job, its step log, and current MACI in
Postgres (`DATABASE_URL`, Compose, migrations on boot). The CLI in
`scripts/deploy_maci` still prints the stdout record and is what `make deploy`
smokes; it does not read Postgres. The backend calls the same TypeScript
`deployMaci` function as the CLI, with injected sncast ops and no coordinator
override.

We rejected a deployments JSON catalog, Last-Event-ID, and changing CLI stdout
to carry job state. Resume/discard of an incomplete checkpoint stays a later
job; this slice records current MACI only after `set_target` and the
coordinator check succeed.
