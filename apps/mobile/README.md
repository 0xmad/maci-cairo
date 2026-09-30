# MACI voter client (`maci-voter`)

Expo **voter client** scaffold. This package is not the Operator console and
does not call ops (ADR-0016). Keys can create an unbound **user private key**
and bind it to one MACI address from the build (ADR-0017). This slice has no
chain SDK, on-chain Signup, or Ballot.

## Run

From the repository root:

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter maci-voter start
```

`apps/mobile/.env` is gitignored. Set `EXPO_PUBLIC_MACI_ADDRESS` there to the
Starknet address of the MACI for this build. An empty or absent value leaves
Keys in an empty state; the app does not accept a pasted address. Restart Expo
after changing the file.

Typecheck and unit tests (no Expo cloud credentials):

```bash
make types-mobile
make test-mobile
```

`eas.json` declares EAS profiles for local/CLI use only. Cloud build and store
submit are out of this slice; clone, typecheck, and unit tests do not need an
Expo token or signing secrets.
