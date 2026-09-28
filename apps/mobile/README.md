# MACI voter client (`maci-mobile`)

Expo **voter client** scaffold. This package is not the Operator console and
does not call ops (ADR-0016). Keys can create an unbound **user private key**
(ADR-0017). This slice has no chain SDK, on-chain Signup, or Ballot.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter maci-mobile start
```

Typecheck and unit tests (no Expo cloud credentials):

```bash
make types-mobile
make test-mobile
```

`eas.json` declares EAS profiles for local/CLI use only. Cloud build and store
submit are out of this slice; clone, typecheck, and unit tests do not need an
Expo token or signing secrets.
