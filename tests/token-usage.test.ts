import { describe, expect, test } from "bun:test";
import { buildChatCompletion } from "../src/proxy/openai";
import { tryParseOpenAiRequest } from "../src/proxy/request-parser";
import {
  buildChatCompletionUsage,
  buildResponsesUsage,
} from "../src/proxy/token-usage";

describe("token usage", () => {
  test("buildChatCompletionUsage returns prompt/completion totals", () => {
    const request = {
      promptText: "Summarize the project status.",
      additionalContext: [
        { text: "user: The project needs a rollout plan.", description: null },
      ],
      contextualResources: { file: "spec.md" },
    } as any;
    const assistantResponse = {
      content: "The rollout should happen in three phases.",
      toolCalls: [],
    } as any;

    const usage = buildChatCompletionUsage(request, assistantResponse) as Record<
      string,
      number
    >;

    expect(usage.prompt_tokens).toBeGreaterThan(0);
    expect(usage.completion_tokens).toBeGreaterThan(0);
    expect(usage.total_tokens).toBe(
      usage.prompt_tokens + usage.completion_tokens,
    );
  });

  test("buildChatCompletion attaches usage", () => {
    const usage = {
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
    };

    const response = buildChatCompletion(
      "m365-copilot",
      {
        content: "Done.",
        toolCalls: [],
        finishReason: "stop",
        strictToolErrorMessage: null,
      } as any,
      "conversation-1",
      true,
      usage,
    ) as Record<string, unknown>;

    expect(response.usage).toEqual(usage);
  });

  test("buildResponsesUsage counts structured input and output text", () => {
    const usage = buildResponsesUsage(
      {
        inputItemsForStorage: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Plan the migration." }],
          },
        ],
      } as any,
      [
        {
          type: "message",
          content: [{ type: "output_text", text: "Start with discovery." }],
        },
      ] as any,
    ) as Record<string, number>;

    expect(usage.input_tokens).toBeGreaterThan(0);
    expect(usage.output_tokens).toBeGreaterThan(0);
    expect(usage.total_tokens).toBe(usage.input_tokens + usage.output_tokens);
  });
});

describe("context compression", () => {
  test("tryParseOpenAiRequest compresses older context into a summary", () => {
    const options = {
      openAiTransformMode: "mapped",
      defaultModel: "m365-copilot",
      defaultTimeZone: "UTC",
      maxAdditionalContextMessages: 3,
    } as any;

    const requestJson = {
      model: "m365-copilot",
      messages: [
        { role: "system", content: "Follow the deployment checklist strictly." },
        {
          role: "user",
          content:
            "We are planning a phased migration with pilot users, approvals, training, and rollback notes.",
        },
        {
          role: "assistant",
          content:
            "I recommend discovery, pilot rollout, broad deployment, and then support stabilization with daily checkpoints.",
        },
        {
          role: "user",
          content:
            "Capture the risks around dependencies, communication timing, and regional rollout variance in detail.",
        },
        {
          role: "assistant",
          content:
            "Risks include missing owners, late environment validation, and weak rollback preparation across regions.",
        },
        {
          role: "user",
          content:
            "Outline the stakeholder communication plan including executive sponsors, regional leads, and end-user training coordinators.",
        },
        {
          role: "assistant",
          content:
            "Communication should flow from executive sponsors to regional leads weekly, with training coordinators briefed bi-weekly on progress and blockers.",
        },
        {
          role: "user",
          content:
            "Detail the rollback strategy for each deployment phase including database migrations, service dependencies, and client cache invalidation.",
        },
        {
          role: "assistant",
          content:
            "Each phase needs a snapshot before deployment, automated rollback scripts for services, database migration reversal procedures, and cache purge triggers.",
        },
        {
          role: "user",
          content:
            "Create the final deployment summary for leadership and call out the next decision we need.",
        },
      ],
      m365_context_token_budget: 500,
      m365_context_recent_messages: 2,
    } as any;

    const parsed = tryParseOpenAiRequest(requestJson, options);
    expect(parsed.ok).toBeTrue();
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    expect(parsed.request.additionalContext.length).toBeGreaterThan(0);
    expect(
      parsed.request.additionalContext.some(
        (item) => item.description === "Compressed previous context",
      ),
    ).toBeTrue();
  });
});
