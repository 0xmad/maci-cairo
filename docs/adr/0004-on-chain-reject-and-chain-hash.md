# On-chain reject and chain hash

A Ballot with an invalid proof reverts and never enters the chain. The chain
hash is the ordered commitment to every accepted Ballot so tally cannot omit
one. Last-wins is applied **while** processing that full sequence (supersede
by user commitment), not by dropping Ballots from the chain.
