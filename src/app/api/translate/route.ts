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
    const translation = await translateText(text, targetLang);
    return NextResponse.json({ translation });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ translation: "Translation unavailable" });
  }
}
