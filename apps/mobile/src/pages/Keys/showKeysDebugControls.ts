/** Separated so tests can mock the production `__DEV__` false branch. */
export const showKeysDebugControls = (): boolean => __DEV__;
