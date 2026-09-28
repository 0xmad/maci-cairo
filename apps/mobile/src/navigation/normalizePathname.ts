export const ROUTES = ["/", "/keys"] as const;

export type AppRoute = (typeof ROUTES)[number];

export const normalizePathname = (pathname: string): AppRoute => {
  if (pathname === "/keys") {
    return "/keys";
  }

  return "/";
};
