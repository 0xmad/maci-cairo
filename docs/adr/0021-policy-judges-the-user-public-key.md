# Policy judges the user public key

A Policy's Subject is the user public key passed to `sign_up`, not the Starknet account that submits the transaction. MACI calls the Enforcer and the vote-balance assigner with that key. Free for all still does not record it, so one account may register many keys. A Relayer account must not choose the vote balance. This replaces the ADR-0019 sentence that MACI calls the Enforcer and the assigner with the caller.
