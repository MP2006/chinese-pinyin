import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { synthesize } from "@/lib/ttsPool";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfter } = await rateLimit(`tts:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { text } = (await request.json()) as { text: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  if (text.length > 500) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 });
  }

  try {
    const { audioStream } = await synthesize(text);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of audioStream) {
            controller.enqueue(new Uint8Array(chunk));
          }
          controller.close();
        } catch {
          controller.error(new Error("TTS stream failed"));
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
