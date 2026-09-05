# MACI assigns poll id; only the Coordinator creates Polls

Poll id is allocated by MACI (`next_poll_id`) at create so Ballot and Tally
proofs bind to an identifier MACI owns, not a caller-chosen integer or the
Poll address. `IMACI.create_poll` is the create entry: the caller must be the
immutable Coordinator account set in MACI's constructor. MACI's constructor
takes the Poll factory class hash and deploys the factory so the factory can
treat its deployer as MACI; factory `create_poll` reverts unless the caller is
that MACI. MACI injects poll id and its own address, records `poll_id → Poll`,
and emits `PollCreated`. We rejected public factory create, caller-chosen poll
ids, a `set_maci` initialize step, and treating the Coordinator as the poll
private key or as the only Tally submitter.
