# Tally is batched, then finalized

Tally is proven in tally batches: each batch updates the chain-hash prefix,
the tally accumulator, and the live-ballot tree (keyed by user commitment).
Last-wins is subtracting the previous live ciphertext and adding the new one,
without decrypting. Unused slots in a batch are not Ballots and are not
absorbed into the chain hash. Tally totals are opened in a separate tally
finalize circuit so the poll private key is not in every batch. We rejected
tallying each batch in isolation, decrypting every batch, and replaying
Ballot proofs inside Tally.
