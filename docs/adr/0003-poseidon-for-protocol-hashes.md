# Poseidon for protocol hashes

Leaf material, user commitment, ballot hash, and chain hash use circomlib
Poseidon over the BN254 scalar field (the same function as the Ballot circuit
and poseidon-lite) so on-chain digests match circuit digests. Starknet
`core::poseidon` is not that function.
