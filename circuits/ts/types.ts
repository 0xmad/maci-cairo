/**
 * Checks whether two readonly tuples/arrays have the same length.
 *
 * Returns `true` when both `A` and `B` have identical `length` types;
 * otherwise, returns `false`.
 *
 * @example
 * type A = SameLength<[string, number], [boolean, Date]>;
 * type B = SameLength<[string], [boolean, Date]>;
 */
export type SameLength<
  A extends readonly unknown[],
  B extends readonly unknown[],
> = A["length"] extends B["length"]
  ? B["length"] extends A["length"]
    ? true
    : false
  : false;
