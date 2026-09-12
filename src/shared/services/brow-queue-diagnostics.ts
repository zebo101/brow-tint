/** Operational diagnostics deliberately exclude error messages, SQL and URLs. */
export function browQueueErrorDetails(error: unknown): {
  name: string;
  code?: string;
} {
  const names = new Set([
    'Error',
    'TypeError',
    'ReferenceError',
    'SyntaxError',
    'RangeError',
    'LibsqlError',
    'DrizzleQueryError',
    'PostgresError',
  ]);
  const source =
    error && typeof error === 'object'
      ? (error as { name?: unknown; code?: unknown; cause?: unknown })
      : {};
  const name =
    typeof source.name === 'string' && names.has(source.name)
      ? source.name
      : 'UnknownError';
  let current: unknown = source;
  for (
    let depth = 0;
    current && typeof current === 'object' && depth < 4;
    depth++
  ) {
    const item = current as { code?: unknown; cause?: unknown };
    if (typeof item.code === 'string' && /^[A-Z0-9_]{1,48}$/.test(item.code))
      return { name, code: item.code };
    current = item.cause;
  }
  return { name };
}
