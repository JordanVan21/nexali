import { useEffect, useState } from "react";

/**
 * Returns `value`, delayed by `delayMs` -- the same debounce pattern
 * already used inline in TransactionFilterBar's search input (Master
 * Spec's "Debounce search" requirement), factored out since Friends
 * search needs the identical behavior for a real server-backed query
 * (avoiding a network request on every keystroke). Cleans up its pending
 * timeout on unmount/re-invocation so a stale update never fires late.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
