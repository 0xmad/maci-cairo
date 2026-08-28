# MACI for Starknet

Privacy-preserving, collusion-resistant voting: Signups live in a state tree
under one MACI instance; Polls accept proof-backed Ballots and are tallied
from the chain hash.

## Language

### Protocol

**MACI**:
A protocol instance that registers Signups in one state tree and is the parent
of its Polls.
_Avoid_: User registry, voting contract (as the name of this concept)

**Poll**:
A voting instance under one MACI, with a Poll public key, a number of vote
options, a schedule, and a chain hash of accepted Ballots.
_Avoid_: Election, round (unless you later mean something else)

### Identity and signup

**Signup**:
The registration of one user public key and its vote balance as a state-tree
leaf.
_Avoid_: User, account, voter (as this concept)

**Subject**:
The Starknet account a Policy judges.
_Avoid_: User, caller (in the glossary)

**User public key**:
The BabyJubJub public key bound to a Signup.
_Avoid_: Public key (bare), coordinator key

**Evidence**:
The payload passed at Signup into the Policy and the vote-balance assigner.
_Avoid_: Signup data, calldata (as this concept)

### Policy

**Policy**:
The configured pair of a Checker and an Enforcer. MACI uses one Enforcer. New
policies are new Checker/Enforcer implementations, not a third kind of
contract.
_Avoid_: Access control, gate, allowlist (as the type name)

**Checker**:
A stateless yes/no whether a Subject plus evidence satisfy the Policy.
_Avoid_: Validator, policy (as a synonym for Checker alone)

**Enforcer**:
The stateful half of a Policy: whether this Subject has already been
enforced, and the call to the Checker.
_Avoid_: Policy (as a synonym for Enforcer alone)

**Vote-balance assigner**:
The configured contract MACI calls at Signup to obtain the vote balance
bound into the leaf. It is read-only. MACI uses one, set when MACI is
constructed. New assignment rules are new implementations of this role
(and a new MACI), not a change to Policy, Checker, or Enforcer.
_Avoid_: Voice credit proxy, Policy
(as this role)

### Polls and voting

**Poll public key**:
The ElGamal key used to encrypt Votes in a Poll. The matching private key
opens the aggregate tally, not individual Ballots.
_Avoid_: Coordinator key, tally key

**Vote option**:
A zero-based slot in a Poll's Ballot. A candidate is one use of a vote
option, not the type.
_Avoid_: Candidate (as the type name)

**Vote**:
The cleartext amount assigned to one vote option. A Ballot holds one Vote per
option (`votes[i]`).
_Avoid_: Ballot, voice credits (unless you adopt that name)

**Vote balance**:
The budget of vote-amount a Signup may put on **one Ballot**. It is assigned
at Signup, bound into the state-tree leaf, and never updated. It is **not
invented inside the Ballot** and **not consumed across Polls**: spending the
full budget on Poll 1 does not reduce Poll 2.
_Avoid_: Voice credits, tokens

**Ballot**:
One submitted, proof-backed encrypted assignment of Votes for a Poll. Invalid
proofs are rejected on-chain and never enter the chain hash.
_Avoid_: Vote, message

**User commitment**:
The poll-scoped binding of a Signup's key to that Poll. Last-wins at tally is
keyed by user commitment, not by state index or Starknet account.
_Avoid_: User, Subject, account

**Ballot hash**:
The binding of a Ballot's poll identity, user commitment, and encrypted
Votes, used to extend the chain hash.
_Avoid_: Vote hash, message hash

**Chain hash**:
The running commitment to the sequence of **accepted** Ballots for a Poll.
Every accepted Ballot is inserted; tally must process that sequence with no
omissions.
_Avoid_: Message tree, ballot tree, skip

**Tally**:
The process that consumes a Poll's accepted Ballots in chain-hash order and
produces totals per vote option. For a given user commitment, only the last
Ballot in that sequence is the vote; earlier ones are **superseded**.
_Avoid_: Skip, drop, coordinator (until this repo has one)

### State tree

**State tree**:
The Merkle tree whose leaves are Signups (plus the padding leaf).
_Avoid_: LeanIMT (in this glossary), voter list

**State-tree leaf**:
The binding of a user public key and vote balance. It is not the hash of the
public key alone.
_Avoid_: Public-key hash (as the definition of the leaf)

**Padding leaf**:
The reserved first state-tree leaf. It is not a Signup.
_Avoid_: User, signup

**State index**:
The position of a leaf in the state tree. It addresses the tree; it does not
name a voter in a Poll.
_Avoid_: User id, voter id

**State root history**:
The ordered state-tree roots after the padding leaf and after each Signup, so
a Ballot can prove against the tree as of a given Signup, not only the live
root. Index `0` is the padded tree, not a Signup.
_Avoid_: Snapshot (unless you mean something else)
