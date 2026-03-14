import { NextRequest, NextResponse } from "next/server";
import { Part } from "@google/generative-ai";
import { getClient, callGemini, parseGeminiResponse, COORD_PROMPT } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = Number(body.lat);
    const lon = Number(body.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ detail: "Invalid latitude or longitude." }, { status: 400 });
    }

    const parts: Part[] = [{ text: COORD_PROMPT(lat, lon) }];
    const ai = getClient();
    const raw = await callGemini(ai, parts);
    const parsed = parseGeminiResponse(raw);

    return NextResponse.json({
      success: true,
      ...parsed,
      message: "Coordinate flood analysis completed.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Gemini AI error: ${msg.slice(0, 300)}` }, { status: 503 });
  }
}
