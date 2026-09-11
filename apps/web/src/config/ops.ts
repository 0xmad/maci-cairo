const OPS_URL_DEFAULT = "http://127.0.0.1:8787";

export function opsBaseUrl(): string {
  return import.meta.env.VITE_BACKEND_OPS_URL ?? OPS_URL_DEFAULT;
}
