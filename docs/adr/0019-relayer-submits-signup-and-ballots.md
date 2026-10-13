# Relayer submits Signup and Ballots

The voter client holds one user private key per MACI and no Starknet account.
It sends a Signup and a finished Ballot to a Relayer over HTTP. The Relayer
submits `sign_up` and `Poll.vote` from its own account and pays its own fees.
A Signup or Ballot is included only when it is on chain; the voter client
reads that event. The Relayer is not the record of inclusion, and it is not
how the client finds MACIs (ADR-0016).

Free for all does not judge a Subject. One Relayer account may register many
user public keys, up to Max Signups. `sign_up` rejects a user public key that
is already in the state tree, for every Policy. MACI still calls the Enforcer
and the vote-balance assigner with the caller. The Free for all Enforcer does
not record that caller. The constant vote-balance assigner ignores it, so each
Signup receives the configured vote balance. Subject-judging policies stay
possible for some other client. Signup Evidence is empty. The Ballot request
is the encrypted Ballot and its proof. The Relayer never receives the user
private key or cleartext Votes.

We rejected an app-held Subject, a vote-sender account, a sponsor-funded
paymaster, and a Relayer-minted Subject per Signup. Those were #59, #66, #67,
and #68. A Relayer can drop a submission, and the client sees only its absence
on chain. Anyone who can reach the Relayer can consume Signups until Max
Signups with Free For All policy.
