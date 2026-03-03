import { randomUUID } from "node:crypto";

type SessionEntry = {
  sessionId: string;
  expiresAtUtc: number;
};

export class SubstrateSessionStore {
  private readonly entries = new Map<string, SessionEntry>();

  constructor(private readonly ttlMinutes: number) {}

  getOrCreate(
    conversationId: string,
    createSessionId: () => string = () => randomUUID(),
    nowUtcMs: number = Date.now(),
  ): string {
    this.purgeExpired(nowUtcMs);
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
      return createSessionId();
    }

    const existing = this.entries.get(normalizedConversationId);
    if (existing) {
      this.entries.set(normalizedConversationId, {
        sessionId: existing.sessionId,
        expiresAtUtc: this.computeExpiry(nowUtcMs),
      });
      return existing.sessionId;
    }

    const sessionId = createSessionId();
    this.entries.set(normalizedConversationId, {
      sessionId,
      expiresAtUtc: this.computeExpiry(nowUtcMs),
    });
    return sessionId;
  }

  set(
    conversationId: string,
    sessionId: string,
    nowUtcMs: number = Date.now(),
  ): void {
    this.purgeExpired(nowUtcMs);
    const normalizedConversationId = conversationId.trim();
    const normalizedSessionId = sessionId.trim();
    if (!normalizedConversationId || !normalizedSessionId) {
      return;
    }
    this.entries.set(normalizedConversationId, {
      sessionId: normalizedSessionId,
      expiresAtUtc: this.computeExpiry(nowUtcMs),
    });
  }

  private computeExpiry(nowUtcMs: number): number {
    return this.ttlMinutes <= 0
      ? Number.MAX_SAFE_INTEGER
      : nowUtcMs + this.ttlMinutes * 60_000;
  }

  private purgeExpired(nowUtcMs: number): void {
    if (this.entries.size === 0) {
      return;
    }
    for (const [conversationId, entry] of this.entries.entries()) {
      if (entry.expiresAtUtc <= nowUtcMs) {
        this.entries.delete(conversationId);
      }
    }
  }
}
