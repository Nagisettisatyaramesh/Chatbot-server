import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "../../config/env";
import { wrapVisitorMessage } from "../security/promptInjection";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export interface AiTurnResult {
  answer: string;
  sufficient: boolean;
  quickReplies: string[];
}

const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond_to_visitor",
  description: "Send the final reply to the website visitor.",
  input_schema: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description: "The reply to show the visitor. Concise, professional, plain text.",
      },
      sufficient: {
        type: "boolean",
        description:
          "true if the KNOWLEDGE BASE contained enough information to answer confidently, false if you are unsure/guessing or the info is missing.",
      },
      quick_replies: {
        type: "array",
        items: { type: "string" },
        maxItems: 3,
        description: "Optional short follow-up suggestions relevant to this business (0-3 items).",
      },
    },
    required: ["answer", "sufficient"],
  },
};

const FALLBACK_ANSWER =
  "I'm sorry, I don't have enough information to answer that confidently. Would you like to speak with our team?";

export async function runChatTurn(systemPrompt: string, visitorMessage: string): Promise<AiTurnResult> {
  if (!isAiConfigured()) {
    // AI not configured server-side yet -- fail safe to human handoff
    // rather than ever inventing an answer.
    return { answer: FALLBACK_ANSWER, sufficient: false, quickReplies: [] };
  }

  try {
    const resp = await getClient().messages.create({
      model: env.anthropicModel,
      max_tokens: 600,
      system: systemPrompt,
      tools: [RESPOND_TOOL],
      tool_choice: { type: "tool", name: "respond_to_visitor" },
      messages: [{ role: "user", content: wrapVisitorMessage(visitorMessage) }],
    });

    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) {
      return { answer: FALLBACK_ANSWER, sufficient: false, quickReplies: [] };
    }

    const input = toolUse.input as { answer?: string; sufficient?: boolean; quick_replies?: string[] };
    const answer = typeof input.answer === "string" && input.answer.trim() ? input.answer.trim() : FALLBACK_ANSWER;
    const sufficient = input.sufficient === true;
    const quickReplies = Array.isArray(input.quick_replies) ? input.quick_replies.slice(0, 3).map(String) : [];

    return { answer: sufficient ? answer : answer || FALLBACK_ANSWER, sufficient, quickReplies };
  } catch (err) {
    console.error("[ai] Claude call failed:", err);
    return { answer: FALLBACK_ANSWER, sufficient: false, quickReplies: [] };
  }
}
