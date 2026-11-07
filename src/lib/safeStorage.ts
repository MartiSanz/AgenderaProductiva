/** Storage access that never throws (private mode, in-app browsers, blocked cookies). */
function pick(kind: "local" | "session"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function safeGet(kind: "local" | "session", key: string): string | null {
  try {
    return pick(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSet(kind: "local" | "session", key: string, value: string): void {
  try {
    pick(kind)?.setItem(key, value);
  } catch {
    /* ignore */
  }
}
