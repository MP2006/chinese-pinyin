import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/translate";
import { rateLimit } from "@/lib/rateLimit";
import { pMap } from "@/lib/concurrency";

const ALLOWED_LANGS = ["en", "vi"];
const MAX_CHARS = 10_000;
const MAX_LINES = 100;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfter } = await rateLimit(`translate:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { text, targetLang: rawLang } = await request.json();
  const targetLang = ALLOWED_LANGS.includes(rawLang) ? rawLang : "en";

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ translation: "" });
  }

  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_CHARS} characters)` },
      { status: 400 }
    );
  }

  const lines = text.split("\n");

  if (lines.length > MAX_LINES) {
    return NextResponse.json(
      { error: `Too many lines (max ${MAX_LINES})` },
      { status: 400 }
    );
  }

  try {
    // Translate each line separately to preserve line structure,
    // limited to 5 concurrent requests to avoid overwhelming upstream APIs
    const results = await pMap(
      lines,
      (line) => (line.trim() ? translateText(line, targetLang) : Promise.resolve("")),
      5
    );
    return NextResponse.json({ translation: results.join("\n") });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ translation: "Translation unavailable" });
  }
}
