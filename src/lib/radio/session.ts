const NAME_KEY = "satish-talk:name";
const KEEP_AWAKE_KEY = "satish-talk:keepAwake";

/**
 * A session identity lives exactly as long as one app load. A fresh id per load
 * avoids every class of stale-mesh bug on reload; the old row sweeps out of the
 * roster within 30s server-side.
 */
export function mintSessionId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function loadDisplayName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // private browsing — losing name persistence is fine
  }
}

const ACCESS_KEY = "satish-talk:remembered-access";
export function loadTeamAccess(): { token: string; code: string } | null {
  try {
    const value = JSON.parse(localStorage.getItem(ACCESS_KEY) || "null");
    return value && typeof value.token === "string" && typeof value.code === "string"
      && /^[A-Za-z0-9_-]{32,256}$/.test(value.token) && value.code.length >= 8
      ? { token: value.token, code: value.code } : null;
  } catch { return null; }
}
export function saveTeamAccess(token: string, code: string): boolean {
  try {
    localStorage.setItem(ACCESS_KEY, JSON.stringify({ token, code }));
    return true;
  } catch { return false; }
}
export function forgetTeamAccess(): void {
  try { localStorage.removeItem(ACCESS_KEY); } catch { /* storage unavailable */ }
}

/** Screen awake is opt-in; persist only the preference. */
export function loadKeepAwake(): boolean {
  try {
    return localStorage.getItem(KEEP_AWAKE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveKeepAwake(on: boolean): void {
  try {
    localStorage.setItem(KEEP_AWAKE_KEY, on ? "1" : "0");
  } catch {
    // private browsing — the default (off) applies next load
  }
}
