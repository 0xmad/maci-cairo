import type { BabyJub as OriginalBabyJub } from "circomlibjs";
import type { F1Field } from "ffjavascript";

// circomlibjs/ffjavascript's published types don't accurately represent
// the Uint8Array-based field element API used by BabyJub at runtime.
type Field = Omit<F1Field, "toObject" | "e" | "eq" | "neg"> & {
  // Convert a field element to a bigint.
  toObject(value: Uint8Array): bigint;

  // Convert a bigint into a field element.
  e(value: bigint): Uint8Array;

  // Compare two field elements for equality.
  eq(a: Uint8Array, b: Uint8Array): boolean;

  // Negate a field element.
  neg(p: Uint8Array): Uint8Array;
};

// Override BabyJub's field type with the corrected Uint8Array-based API.
type FixedBabyJub = Omit<OriginalBabyJub, "F"> & {
  F: Field;
};

// Override buildBabyjub() so callers receive the corrected BabyJub type.
declare module "circomlibjs" {
  function buildBabyjub(): Promise<FixedBabyJub>;
}
