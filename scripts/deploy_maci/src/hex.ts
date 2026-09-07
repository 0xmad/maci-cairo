/*
 * Felt addresses as 32-byte `0x`-prefixed hex.
 */

/** First prefunded account from `starknet-devnet --seed 0` (`devnet-1`). */
export const DEVNET_SEED0_DEVNET_1 = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";

/**
 * Lowercases and left-pads a hex felt to 32 bytes.
 *
 * @param value - Hex with or without `0x`.
 * @returns Canonical `0x` + 64 hex digits.
 * @throws If `value` is empty or contains non-hex characters.
 */
export function normalizeHex(value: string): string {
  const hex = value.trim().toLowerCase().replace(/^0x/, "");

  if (hex.length === 0 || !/^[0-9a-f]+$/u.test(hex)) {
    throw new Error(`invalid hex: ${value}`);
  }

  return `0x${hex.padStart(64, "0")}`;
}

/**
 * Coordinator written into MACI constructor calldata.
 *
 * @param override - Non-empty hex from `COORDINATOR_OVERRIDE`; otherwise seed-0 `devnet-1`.
 */
export function intendedCoordinator(override: string | undefined): string {
  if (override !== undefined && override.length > 0) {
    return normalizeHex(override);
  }

  return normalizeHex(DEVNET_SEED0_DEVNET_1);
}
