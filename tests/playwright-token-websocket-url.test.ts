import { describe, expect, test } from "bun:test";
import { withDisableMemoryForSubstrateHubUrl } from "../src/cli/playwright-token.node.mjs";

describe("withDisableMemoryForSubstrateHubUrl", () => {
  test("adds disableMemory=1 for substrate hub URLs when missing", () => {
    const rewritten = withDisableMemoryForSubstrateHubUrl(
      "wss://substrate.office.com/m365Copilot/Chathub?access_token=token-1",
    );

    const parsed = new URL(rewritten);
    expect(parsed.searchParams.get("access_token")).toBe("token-1");
    expect(parsed.searchParams.get("disableMemory")).toBe("1");
  });

  test("does not override an existing disableMemory value", () => {
    const original =
      "wss://substrate.office.com/m365Copilot/Chathub?access_token=token-1&disableMemory=0";
    const rewritten = withDisableMemoryForSubstrateHubUrl(original);
    expect(rewritten).toBe(original);
  });

  test("ignores non-substrate websocket URLs", () => {
    const original =
      "wss://example.com/m365Copilot/Chathub?access_token=token-1";
    const rewritten = withDisableMemoryForSubstrateHubUrl(original);
    expect(rewritten).toBe(original);
  });

  test("ignores non-chat-hub substrate paths", () => {
    const original = "wss://substrate.office.com/m365Copilot/notChathub";
    const rewritten = withDisableMemoryForSubstrateHubUrl(original);
    expect(rewritten).toBe(original);
  });
});
