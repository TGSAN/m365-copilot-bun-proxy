import { describe, expect, test } from "bun:test";
import { SubstrateSessionStore } from "../src/proxy/substrate-session-store";

describe("SubstrateSessionStore", () => {
  test("reuses session id for repeated turns in the same conversation", () => {
    const store = new SubstrateSessionStore(180);
    let created = 0;
    const createSessionId = () => `session-${++created}`;

    const first = store.getOrCreate("conversation-1", createSessionId, 1_000);
    const second = store.getOrCreate("conversation-1", createSessionId, 2_000);

    expect(first).toBe("session-1");
    expect(second).toBe("session-1");
    expect(created).toBe(1);
  });

  test("creates a new session id after ttl expiration", () => {
    const store = new SubstrateSessionStore(1);
    let created = 0;
    const createSessionId = () => `session-${++created}`;

    const first = store.getOrCreate("conversation-1", createSessionId, 0);
    const second = store.getOrCreate(
      "conversation-1",
      createSessionId,
      61_000,
    );

    expect(first).toBe("session-1");
    expect(second).toBe("session-2");
  });

  test("can bind a known session id to a conversation id", () => {
    const store = new SubstrateSessionStore(180);
    store.set("conversation-2", "session-bound", 1_000);

    const resolved = store.getOrCreate("conversation-2", () => "session-new", 2_000);
    expect(resolved).toBe("session-bound");
  });
});
