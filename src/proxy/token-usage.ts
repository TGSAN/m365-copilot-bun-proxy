import type {
  JsonObject,
  JsonValue,
  OpenAiAssistantResponse,
  ParsedOpenAiRequest,
  ParsedResponsesRequest,
} from "./types";

type TextLikePart = {
  text: string;
  description?: string | null;
};

type IndexedToken = {
  value: string;
  start: number;
  end: number;
};

const TOKEN_PATTERN =
  /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|[\p{L}\p{N}_]+(?:['’.-][\p{L}\p{N}_]+)*|[^\s]/gu;

export function countTextTokens(text: string): number {
  return tokenizeWithIndexes(text).length;
}

export function truncateTextToTokenBudget(
  text: string,
  tokenBudget: number,
): string {
  if (tokenBudget <= 0) {
    return "";
  }
  const normalized = text.trim();
  if (!normalized) {
    return "";
  }
  const tokens = tokenizeWithIndexes(normalized);
  if (tokens.length <= tokenBudget) {
    return normalized;
  }
  const endIndex = tokens[Math.max(0, tokenBudget - 1)]?.end ?? normalized.length;
  return `${normalized.slice(0, endIndex).trim()} ...`;
}

export function countContextMessagesTokens(messages: TextLikePart[]): number {
  return countTextTokens(
    messages
      .map((message) => formatTextLikePart(message))
      .filter((segment) => segment.length > 0)
      .join("\n"),
  );
}

export function buildChatCompletionUsage(
  request: ParsedOpenAiRequest,
  assistantResponse: OpenAiAssistantResponse,
): JsonObject {
  const promptTokens = countTextTokens(buildChatPromptText(request));
  const completionTokens = countTextTokens(
    buildAssistantResponseTokenText(assistantResponse),
  );
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

export function buildResponsesUsage(
  parsedRequest: ParsedResponsesRequest,
  output: JsonObject[],
): JsonObject {
  const inputTokens = countTextTokens(
    extractResponsesInputText(parsedRequest.inputItemsForStorage),
  );
  const outputTokens = countTextTokens(extractResponseOutputText(output));
  return {
    input_tokens: inputTokens,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: outputTokens,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: inputTokens + outputTokens,
  };
}

export function extractResponseOutputText(output: JsonObject[]): string {
  const segments: string[] = [];
  for (const item of output) {
    if ((item.type ?? "") !== "message") {
      continue;
    }
    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const contentItem of content) {
      if (
        !contentItem ||
        typeof contentItem !== "object" ||
        Array.isArray(contentItem)
      ) {
        continue;
      }
      const typed = contentItem as Record<string, unknown>;
      if ((typed.type ?? "") !== "output_text") {
        continue;
      }
      const text = typed.text;
      if (typeof text === "string" && text.length > 0) {
        segments.push(text);
      }
    }
  }
  return segments.join("");
}

export function extractResponsesInputText(inputItems: JsonValue[]): string {
  const segments: string[] = [];
  for (const inputItem of inputItems) {
    if (
      !inputItem ||
      typeof inputItem !== "object" ||
      Array.isArray(inputItem)
    ) {
      continue;
    }
    const record = inputItem as Record<string, unknown>;
    const content = record.content;
    if (typeof content === "string") {
      if (content.trim().length > 0) {
        segments.push(content);
      }
      continue;
    }
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (!part || typeof part !== "object" || Array.isArray(part)) {
        continue;
      }
      const partRecord = part as Record<string, unknown>;
      const text = partRecord.text;
      if (typeof text === "string" && text.trim().length > 0) {
        segments.push(text);
      }
    }
  }
  return segments.join("\n");
}

function buildChatPromptText(request: ParsedOpenAiRequest): string {
  const segments: string[] = [];
  if (request.promptText.trim()) {
    segments.push(request.promptText.trim());
  }
  for (const item of request.additionalContext) {
    const segment = formatTextLikePart(item);
    if (segment) {
      segments.push(segment);
    }
  }
  if (request.contextualResources) {
    segments.push(stringifyJson(request.contextualResources));
  }
  return segments.join("\n");
}

function buildAssistantResponseTokenText(
  assistantResponse: OpenAiAssistantResponse,
): string {
  if (assistantResponse.toolCalls.length > 0) {
    return assistantResponse.toolCalls
      .map((toolCall) => `${toolCall.name} ${toolCall.argumentsJson}`)
      .join("\n");
  }
  return assistantResponse.content ?? "";
}

function formatTextLikePart(part: TextLikePart): string {
  const text = part.text.trim();
  if (!text) {
    return "";
  }
  const description = part.description?.trim();
  return description ? `${description}: ${text}` : text;
}

function stringifyJson(value: JsonValue | JsonObject): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function tokenizeWithIndexes(text: string): IndexedToken[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  TOKEN_PATTERN.lastIndex = 0;
  const matches = normalized.matchAll(TOKEN_PATTERN);
  const tokens: IndexedToken[] = [];
  for (const match of matches) {
    const value = match[0];
    const start = match.index ?? 0;
    tokens.push({ value, start, end: start + value.length });
  }
  return tokens;
}
