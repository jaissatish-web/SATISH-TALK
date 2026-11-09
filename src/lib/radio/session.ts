const NAME_KEY = "satish-talk:name";
const CODE_KEY = "satish-talk:code";
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

/** Access code is remembered per device so the team enters it once. */
export function loadAccessCode(): string {
  try {
    return sessionStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAccessCode(code: string): void {
  try {
    sessionStorage.setItem(CODE_KEY, code);
  } catch {
    // private browsing — they'll re-enter next time
  }
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
