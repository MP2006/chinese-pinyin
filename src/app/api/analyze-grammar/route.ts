import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import type { GrammarAnalysis } from "@/types/grammar";
import { GEMINI_MODEL } from "@/lib/gemini";

const MAX_CHARS = 200;

const grammarSchema = z.object({
  sentence: z.string(),
  translation: z.string(),
  pattern: z.string(),
  chunks: z
    .array(
      z.object({
        chunk: z.string(),
        pinyin: z.string(),
        role: z.string(),
        meaning: z.string(),
      })
    )
    .min(1),
  note: z.string(),
  isCorrect: z.boolean(),
  correction: z.string().optional(),
  correctionPinyin: z.string().optional(),
  feedback: z.string().optional(),
});

const geminiSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    sentence: { type: SchemaType.STRING },
    translation: { type: SchemaType.STRING },
    pattern: { type: SchemaType.STRING },
    chunks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          chunk: { type: SchemaType.STRING },
          pinyin: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING },
          meaning: { type: SchemaType.STRING },
        },
        required: ["chunk", "pinyin", "role", "meaning"],
      },
    },
    note: { type: SchemaType.STRING },
    isCorrect: { type: SchemaType.BOOLEAN },
    correction: { type: SchemaType.STRING },
    correctionPinyin: { type: SchemaType.STRING },
    feedback: { type: SchemaType.STRING },
  },
  required: ["sentence", "translation", "pattern", "chunks", "note", "isCorrect", "correction", "correctionPinyin", "feedback"],
};

function buildPrompt(text: string, lang: string): string {
  const targetLang = lang === "vi" ? "Vietnamese" : "English";
  return `You are a Chinese language grammar expert. Analyze the following Chinese text and break it down into grammatical components. Also check the grammar for correctness.

Text: "${text}"

Respond in ${targetLang} for the translation, meaning, pattern description, note, and feedback fields.

Rules:
- "sentence": the original Chinese text
- "translation": natural ${targetLang} translation
- "pattern": the grammatical pattern/structure name (e.g., "Subject + Verb + Object", "把 construction", "是...的 structure")
- "chunks": break the sentence into meaningful grammatical chunks. Each chunk has:
  - "chunk": the Chinese characters
  - "pinyin": pinyin with tone marks
  - "role": grammatical role (e.g., "Subject", "Verb", "Object", "Adverb", "Measure Word", "Particle", "Complement", "Preposition")
  - "meaning": brief ${targetLang} translation of this chunk
- "note": a brief, helpful grammar tip or explanation about this sentence's structure (1-2 sentences)
- "isCorrect": whether the sentence has correct grammar (true or false)
- "correction": if isCorrect is false, provide the corrected Chinese sentence. If isCorrect is true, set to empty string ""
- "correctionPinyin": if isCorrect is false, provide the pinyin (with tone marks) for the corrected sentence. If isCorrect is true, set to empty string ""
- "feedback": if isCorrect is false, explain what the grammar error is and why the correction fixes it (in ${targetLang}, 1-2 sentences). If isCorrect is true, set to empty string ""

IMPORTANT: Only set "isCorrect" to false if the sentence contains a fundamental structural or grammatical error (e.g., wrong word order, incorrect measure word usage, missing required particles). Do NOT flag casual colloquialisms, native slang, or omitted subject pronouns as incorrect — these are standard in spoken Chinese.

IMPORTANT: When you provide a "correction", you MUST also provide the "correctionPinyin".

CRITICAL: You MUST provide a direct, concise ${targetLang} translation for the "meaning" field in EVERY item of the "chunks" array. Do not leave the "meaning" field blank or use empty strings, even for grammatical particles (e.g., 了 = "completion marker", 的 = "possessive/descriptive particle").

Keep roles concise (1-2 words). Keep meanings brief.`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Grammar analysis is not configured" },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfter } = await rateLimit(`grammar:${ip}`, {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let text: string;
  let lang: string;
  try {
    const body = await request.json();
    text = body.text;
    lang = body.lang;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Text is required" },
      { status: 400 }
    );
  }

  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_CHARS} characters)` },
      { status: 400 }
    );
  }

  const targetLang = lang === "vi" ? "vi" : "en";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
      },
    });

    const result = await model.generateContent(buildPrompt(text, targetLang));
    const response = result.response;
    const jsonText = response.text();

    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse Gemini response:", jsonText);
      return NextResponse.json(
        { error: "Invalid response from AI" },
        { status: 502 }
      );
    }

    let parsed: GrammarAnalysis;
    try {
      parsed = grammarSchema.parse(raw);
    } catch (err) {
      console.error("Zod validation failed:", err);
      return NextResponse.json(
        { error: "Invalid response from AI" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Grammar analysis error:", error);
    return NextResponse.json(
      { error: "Grammar analysis failed" },
      { status: 500 }
    );
  }
}
