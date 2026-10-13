# Relayer is its own HTTP package

The Relayer is a `maci-relayer` package on the same NestJS and Fastify shell as ops, not a module of `maci-ops`. The shell has no Postgres, because the Relayer is not the record of inclusion, and no Starknet account until it submits Signup (#71). We rejected folding submission into the Operator job server.
