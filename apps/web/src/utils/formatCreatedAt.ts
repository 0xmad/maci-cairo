/** Format a UTC instant as `YYYY-MM-DD HH:mm UTC`. */
export function formatCreatedAt(createdAtMs: number): string {
  const iso = new Date(createdAtMs).toISOString();

  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Format unix seconds as `YYYY-MM-DD HH:mm UTC`. */
export function formatUnixSeconds(unixSeconds: string): string {
  return formatCreatedAt(Number(unixSeconds) * 1000);
}
