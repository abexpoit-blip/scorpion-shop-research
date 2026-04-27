// Tracks which "mode" the user is operating in (buyer vs seller) for accounts
// that hold multiple roles. Persisted per-user in localStorage so it survives
// reloads but doesn't leak across accounts.

export type ActiveRole = "buyer" | "seller";

const KEY = "cruzercc.activeRole";

interface Stored {
  uid: string;
  role: ActiveRole;
}

export function getActiveRole(uid: string | null | undefined): ActiveRole | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed.uid === uid ? parsed.role : null;
  } catch {
    return null;
  }
}

export function setActiveRole(uid: string, role: ActiveRole) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ uid, role } satisfies Stored));
  } catch {
    /* ignore */
  }
}

export function clearActiveRole() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
