import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

let ttsClient: MsEdgeTTS | null = null;

async function getClient(): Promise<MsEdgeTTS> {
  if (!ttsClient) {
    ttsClient = new MsEdgeTTS();
    await ttsClient.setMetadata(
      "zh-CN-XiaoxiaoNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );
  }
  return ttsClient;
}

export async function POST(request: NextRequest) {
  const { text } = (await request.json()) as { text: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  if (text.length > 500) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 });
  }

  try {
    const client = await getClient();
    const { audioStream } = client.toStream(text, { rate: 0.9 });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audio = Buffer.concat(chunks);

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    // Reset client on error so next request creates a fresh connection
    ttsClient = null;
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
