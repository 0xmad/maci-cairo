/*
 * sncast `--json` emits JSONL mixed with warn text; class-hash errors include the hash.
 */
const ALREADY_DECLARED = /class hash (0x[0-9a-fA-F]+)/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Parse one `{...}` object starting at `start`, respecting quoted braces.
 *
 * @returns Parsed value and index after the closing `}`, or `undefined` if unclosed.
 */
function scanJsonObject(raw: string, start: number): { value: unknown; end: number } | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: JSON.parse(raw.slice(start, index + 1)) as unknown, end: index + 1 };
      }
    }
  }

  return undefined;
}

/**
 * Pull JSON objects out of mixed sncast stdout/stderr (JSONL plus compiler warn lines).
 */
export function extractJsonObjects(raw: string): unknown[] {
  const objects: unknown[] = [];
  let index = 0;

  while (index < raw.length) {
    if (raw[index] !== "{") {
      index += 1;
    } else {
      const scanned = scanJsonObject(raw, index);
      if (scanned === undefined) {
        break;
      }
      objects.push(scanned.value);
      index = scanned.end;
    }
  }

  return objects;
}

function stringifyField(value: unknown, key: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error(`empty JSON list for ${key}`);
    }

    return String(value[0]);
  }

  return String(value);
}

function errorMessage(last: Record<string, unknown>): string {
  if (typeof last.error === "string") {
    return last.error;
  }

  return JSON.stringify(last);
}

/**
 * Read `key` from the last sncast response or error object.
 *
 * Warn-only JSON is ignored. An already-declared class is success when `key` is
 * `class_hash`. Call results prefer `response_raw[0]` over `response`.
 *
 * @throws If there is no command result, the command failed, or `key` is missing.
 */
export function parseSncastField(raw: string, key: string): string {
  const objects = extractJsonObjects(raw).filter(isRecord);

  if (objects.length === 0) {
    throw new Error("sncast output had no JSON object");
  }

  const results = objects.filter((obj) => obj.type === "response" || obj.type === "error" || "command" in obj);
  const last = results.at(-1);

  if (last === undefined) {
    throw new Error("sncast output had no JSON object");
  }

  if (last.type === "error" || last.error !== undefined) {
    const error = errorMessage(last);
    const match = ALREADY_DECLARED.exec(error);

    if (key === "class_hash" && match?.[1] !== undefined) {
      return match[1];
    }

    throw new Error(error);
  }

  if (key === "response" && Array.isArray(last.response_raw)) {
    if (last.response_raw.length === 0) {
      throw new Error(`empty response_raw: ${JSON.stringify(last)}`);
    }

    return String(last.response_raw[0]);
  }

  const value = last[key];

  if (value !== undefined && value !== null && value !== "") {
    return stringifyField(value, key);
  }

  throw new Error(`missing JSON field ${key}: ${JSON.stringify(last)}`);
}
