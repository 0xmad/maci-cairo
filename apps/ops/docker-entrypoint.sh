#!/bin/sh
set -eu

rpc="${STARKNET_RPC_URL%/}"
i=0
until curl -sf "${rpc}/is_alive" >/dev/null; do
  i=$((i + 1))
  if [ "${i}" -ge 60 ]; then
    echo "starknet-devnet was not ready at ${rpc}" >&2
    exit 1
  fi
  sleep 1
done

if ! command -v sncast >/dev/null; then
  echo "sncast is not on PATH" >&2
  exit 1
fi

# Seed-0 prefunded account (`devnet-1`). Re-import is ignored if the name exists.
sncast account import \
  --name devnet-1 \
  --address 0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691 \
  --private-key 0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9 \
  --type oz \
  --url "${rpc}" \
  --silent \
  || true

exec pnpm start
