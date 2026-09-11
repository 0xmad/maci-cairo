# Coordinator is server-held; wallet is Operator login

MACI stand-up and later Create Poll jobs run as the ops server's sncast
`devnet` account. That account is the Coordinator written into MACI. An
allowlisted Operator wallet signs a login nonce only; it does not sign
protocol transactions and is not Coordinator.

We rejected in-wallet declare/deploy, `COORDINATOR_OVERRIDE` on the backend,
and letting the console Network switcher choose job RPC. Jobs always use the
server sncast profile. This reopens the ADR-0010 rejection of wiring the web
Deploy path, now as a server job rather than a wallet-signed graph.
