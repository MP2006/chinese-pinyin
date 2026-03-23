import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8100";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfter } = await rateLimit(`ocr:${ip}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    const ocrForm = new FormData();
    ocrForm.append("file", file);

    const res = await fetch(`${OCR_SERVICE_URL}/recognize`, {
      method: "POST",
      body: ocrForm,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "OCR service error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "OCR service unavailable" },
      { status: 503 }
    );
  }
}
