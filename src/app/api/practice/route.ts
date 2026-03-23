import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { rateLimit } from "@/lib/rateLimit";
import { practiceResponseSchema } from "@/types/practice";
import type { HSKLevel, ScenarioId } from "@/types/practice";
import { GEMINI_MODEL } from "@/lib/gemini";

const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 500;

const requestSchema = {
  isValid(body: Record<string, unknown>): body is {
    hskLevel: HSKLevel;
    scenarioId: ScenarioId;
    characterName: string;
    objective?: string;
    messages: { role: "user" | "assistant"; content: string }[];
  } {
    const { hskLevel, scenarioId, characterName, messages } = body;
    return (
      typeof hskLevel === "number" &&
      hskLevel >= 1 &&
      hskLevel <= 9 &&
      typeof scenarioId === "string" &&
      typeof characterName === "string" &&
      characterName.length > 0 &&
      Array.isArray(messages) &&
      messages.length <= MAX_MESSAGES
    );
  },
};

const SCENARIO_DESCRIPTIONS: Record<ScenarioId, string> = {
  restaurant: "a restaurant. You are a waiter/waitress taking the customer's order.",
  train_station: "a train station. You are a ticket booth attendant helping a traveler.",
  making_friends: "a casual social setting. You are meeting someone new.",
  shopping: "a shop or market. You are a shopkeeper helping a customer.",
  hotel: "a hotel front desk. You are the receptionist helping a guest.",
  directions: "a street corner. You are a local helping someone find their way.",
};

function buildInitialPrompt(
  hskLevel: HSKLevel,
  scenarioId: ScenarioId,
  characterName: string,
): string {
  return `You are ${characterName}, a native Chinese speaker in a roleplay scenario. You are in ${SCENARIO_DESCRIPTIONS[scenarioId]}

RULES — follow these strictly:
1. You are ${characterName}. NEVER break character. NEVER speak as an AI assistant.
2. Respond ONLY in Mandarin Chinese at HSK level ${hskLevel} vocabulary. Do not use vocabulary above HSK ${hskLevel}.
3. Keep responses natural and conversational — 1-3 sentences maximum.
4. Generate a UNIQUE, specific, concrete, achievable objective for this scenario appropriate for an HSK ${hskLevel} learner. The objective should be a single clear task with specific details (specific items, quantities, destinations, times, etc.). Be creative and varied — never repeat common objectives. Randomness seed: ${Math.random().toString(36).slice(2, 8)}. The "generatedObjective" field MUST be written in English — never in Chinese.
5. Set "isObjectiveMet" to false.
6. The "pinyin" field must be the exact pinyin with tone marks for your "hanzi" response.
7. The "english" field must be a natural English translation of your "hanzi" response.
8. Include "vocabHints" — an array of 3-5 key vocabulary words from the objective that the user will need. Each hint has "english" (the English word/phrase), "chinese" (the Chinese word at HSK ${hskLevel} level), and "pinyin" (with tone marks). Focus on nouns, verbs, and adjectives critical to completing the objective.
9. Start the conversation in character — greet the user or set the scene naturally.`;
}

function buildConversationPrompt(
  hskLevel: HSKLevel,
  scenarioId: ScenarioId,
  objective: string,
  characterName: string,
): string {
  return `You are ${characterName}, a native Chinese speaker in a roleplay scenario. You are in ${SCENARIO_DESCRIPTIONS[scenarioId]}

RULES — follow these strictly:
1. You are ${characterName}. NEVER break character. NEVER speak as an AI assistant.
2. Respond ONLY in Mandarin Chinese at HSK level ${hskLevel} vocabulary. Do not use vocabulary above HSK ${hskLevel}.
3. Keep responses natural and conversational — 1-3 sentences maximum.
4. The user's hidden objective is: "${objective}". On every turn, evaluate whether the user has successfully communicated this objective through the conversation.
5. Set "isObjectiveMet" to true ONLY when the user has clearly and successfully achieved the objective through their Chinese messages.
6. When "isObjectiveMet" is true, provide "feedback" — a 1-2 sentence assessment IN ENGLISH of the user's grammar and vocabulary usage throughout the conversation. Be encouraging but honest. The feedback MUST be in English, never in Chinese.
7. When "isObjectiveMet" is false, leave "feedback" empty.
8. The "pinyin" field must be the exact pinyin with tone marks for your "hanzi" response.
9. The "english" field must be a natural English translation of your "hanzi" response.`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Practice chat is not configured" },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfter } = await rateLimit(`practice:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!requestSchema.isValid(body)) {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 },
    );
  }

  const { hskLevel, scenarioId, characterName, objective, messages } = body;

  // Validate individual message content lengths
  for (const msg of messages) {
    if (typeof msg.content !== "string" || msg.content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: "Message content too long" },
        { status: 400 },
      );
    }
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google(GEMINI_MODEL);

    if (messages.length === 0) {
      // First call: generate objective + greeting
      const systemPrompt = buildInitialPrompt(hskLevel, scenarioId, characterName);
      const { object } = await generateObject({
        model,
        schema: practiceResponseSchema,
        system: systemPrompt,
        prompt: "Start the conversation in character. Generate a unique and creative objective — do NOT use common examples like ordering noodle soup. Think of something original and interesting for this scenario.",
      });
      return NextResponse.json(object);
    } else {
      // Ongoing conversation: evaluate against provided objective
      if (!objective || typeof objective !== "string") {
        return NextResponse.json(
          { error: "Objective required for ongoing conversation" },
          { status: 400 },
        );
      }
      const systemPrompt = buildConversationPrompt(hskLevel, scenarioId, objective, characterName);
      const { object } = await generateObject({
        model,
        schema: practiceResponseSchema,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });
      return NextResponse.json(object);
    }
  } catch (error) {
    console.error("Practice chat error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 },
    );
  }
}
