import { showKeysDebugControls } from "../showKeysDebugControls";

describe("showKeysDebugControls", () => {
  it("follows the __DEV__ flag", () => {
    expect(showKeysDebugControls()).toBe(__DEV__);
  });
});
