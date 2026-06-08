// In-memory store for pending sessions (fixes Safari ITP cross-site cookie blocking)
// Sessions expire after 60 seconds — only used during the OAuth handshake

interface PendingSession {
  token: string;
  expiresAt: number;
}

const pending = new Map<string, PendingSession>();

function randomCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function storePendingSession(token: string): string {
  // Clean expired entries
  const now = Date.now();
  for (const [k, v] of pending) {
    if (v.expiresAt < now) pending.delete(k);
  }

  const code = randomCode();
  pending.set(code, { token, expiresAt: now + 60_000 });
  return code;
}

export function consumePendingSession(code: string): string | null {
  const entry = pending.get(code);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { pending.delete(code); return null; }
  pending.delete(code);
  return entry.token;
}
