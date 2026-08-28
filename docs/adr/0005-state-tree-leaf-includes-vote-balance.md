# State-tree leaf includes vote balance

A Signup leaf binds user public key **and** vote balance (as the Ballot
circuit already proves). Hashing only the public key at `sign_up` is a bug
against this invariant, not a competing design.
