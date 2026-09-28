import { normalizePathname, type AppRoute } from "../normalizePathname";

describe("normalizePathname", () => {
  it.each<[string, AppRoute]>([
    ["", "/"],
    ["/index", "/"],
    ["/", "/"],
    ["/unknown", "/"],
    ["/keys/extra", "/"],
    ["/keys", "/keys"],
  ])("maps %j to %j", (pathname, expected) => {
    expect(normalizePathname(pathname)).toBe(expected);
  });
});
