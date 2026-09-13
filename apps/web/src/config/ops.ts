const OPS_URL_DEFAULT = "http://127.0.0.1:8787";
const OPS_DEV_PROXY = "/ops";

function isLoopbackOps(url: string): boolean {
  try {
    const parsed = new URL(url, "http://localhost");

    return (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && parsed.port === "8787";
  } catch {
    return false;
  }
}

export function opsBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_OPS_URL;

  if (import.meta.env.DEV && (configured === undefined || isLoopbackOps(configured))) {
    return new URL(OPS_DEV_PROXY, globalThis.location.origin).href;
  }

  return configured ?? OPS_URL_DEFAULT;
}
