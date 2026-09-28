# User private key is generated before MACI bind

The voter client holds one user private key per MACI and must not reuse a key
across MACIs (`CONTEXT.md`). The product path still needs a keys slice before a
MACI address exists (hardcoded env until the registry contract lands; see
ADR-0016). We generate and secure-store an unbound user private key on an
explicit CTA, then bind that key to a MACI when the address is selected. A later
MACI gets a new key. We rejected generating only at Signup (no real keys slice
before Subject/MACI) and temporarily one key per install (would normalize reuse
across MACIs).
