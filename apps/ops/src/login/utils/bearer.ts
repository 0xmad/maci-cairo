/** First Bearer token from a Fastify `authorization` header (string or repeated). */
export function readBearer(header: string | string[] | undefined): string | undefined {
  const combined = Array.isArray(header) ? header[0] : header;
  const value = combined?.split(",")[0]?.trim();

  if (!value?.startsWith("Bearer ")) {
    return undefined;
  }

  return value.slice("Bearer ".length);
}
