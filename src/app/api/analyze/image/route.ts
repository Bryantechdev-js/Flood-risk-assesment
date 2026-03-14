import { NextRequest, NextResponse } from "next/server";
import { Part } from "@google/generative-ai";
import { getClient, callGemini, parseGeminiResponse, IMAGE_PROMPT } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json({ detail: "Please upload a valid image file." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ detail: "File size exceeds 10 MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const parts: Part[] = [
      { text: IMAGE_PROMPT },
      { inlineData: { mimeType: file.type, data: base64 } },
    ];

    const ai = getClient();
    const raw = await callGemini(ai, parts);
    const parsed = parseGeminiResponse(raw);

    return NextResponse.json({
      success: true,
      ...parsed,
      message: `Analysis complete: ${parsed.detection_type.replace(/_/g, " ")} detected.`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Gemini AI error: ${msg.slice(0, 300)}` }, { status: 503 });
  }
}
