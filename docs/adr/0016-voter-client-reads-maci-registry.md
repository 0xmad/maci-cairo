# Voter client reads a MACI registry over RPC, not ops

The voter client never calls `maci-ops` (HTTP or package). Ops is the Operator
job store and stand-up console; voter state lives on chain. The client finds
MACI instances by RPC-reading a MACI registry whose address is hardcoded per
network. Stand-up writes registry entries; the writer is Coordinator-scoped for
that deployment. We rejected mirroring the web `OpsClient` catalog, a GraphQL
or indexer-first read path, and paste / QR / deep-link discovery (those still
need a trust root and are easy to phish). The hardcoded registry is a
deliberate trust root; a more decentralized list is a later change, not a
reason to put a discovery server in the voter client.
