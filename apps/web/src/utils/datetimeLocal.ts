const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DDTHH:mm` for `datetime-local` inputs. */
export function toDatetimeLocalValue(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function startOfLocalDay(date: Date): string {
  return `${toDatetimeLocalValue(date).slice(0, 10)}T00:00`;
}

export function isDatetimeLocalValue(value: string): boolean {
  return DATETIME_LOCAL.test(value);
}

export function unixSecondsFromDatetimeLocal(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}
