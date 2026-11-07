const KEY = "agendera_known_user";

/** Marks this browser as belonging to someone who already accessed Agendera. */
export function markKnownUser() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isKnownUser() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
