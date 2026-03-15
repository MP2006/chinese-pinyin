import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/translate";

const ALLOWED_LANGS = ["en", "vi"];

export async function POST(request: NextRequest) {
  const { text, targetLang: rawLang } = await request.json();
  const targetLang = ALLOWED_LANGS.includes(rawLang) ? rawLang : "en";

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ translation: "" });
  }

  try {
    // Translate each line separately to preserve line structure,
    // but within a single API request for efficiency
    const lines = text.split("\n");
    const results = await Promise.all(
      lines.map((line) =>
        line.trim() ? translateText(line, targetLang) : Promise.resolve("")
      )
    );
    return NextResponse.json({ translation: results.join("\n") });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ translation: "Translation unavailable" });
  }
}
