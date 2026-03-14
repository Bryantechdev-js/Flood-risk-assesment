import { GoogleGenerativeAI, Part, Content } from "@google/generative-ai";

export const GEMINI_MODEL = "gemini-2.5-flash-lite";

export function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables.");
  return new GoogleGenerativeAI(key);
}

export async function callGemini(
  ai: GoogleGenerativeAI,
  parts: Part[]
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
      const content: Content = { role: "user", parts };
      const result = await model.generateContent({ contents: [content] });
      return result.response.text();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429") && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      } else {
        throw e;
      }
    }
  }
  throw new Error("Gemini call failed after retries");
}

export function parseGeminiResponse(raw: string) {
  try {
    const cleaned = raw.replace(/```(?:json)?|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const d = JSON.parse(match[0]);
      return {
        detection_type:      String(d.detection_type      ?? "flood"),
        risk_level:          String(d.risk_level           ?? "Medium"),
        subject:             String(d.subject              ?? "Unknown"),
        description:         String(d.description          ?? ""),
        symptoms:            Array.isArray(d.symptoms)   ? d.symptoms   : [],
        solutions:           Array.isArray(d.solutions)  ? d.solutions  : [],
        prevention:          Array.isArray(d.prevention) ? d.prevention : [],
        elevation:           Number(d.elevation            ?? 0),
        distance_from_water: Number(d.distance_from_water  ?? 0),
      };
    }
  } catch { /* fall through to default */ }
  return {
    detection_type: "flood", risk_level: "Medium",
    subject: "Analysis incomplete", description: raw.slice(0, 300),
    symptoms: [], solutions: [], prevention: [],
    elevation: 0, distance_from_water: 0,
  };
}

export const IMAGE_PROMPT = `
You are an expert environmental analyst specializing in flood risk assessment,
plant pathology, and veterinary disease detection.

Look at this image carefully and determine what it shows:
- If it shows terrain, water, flooding, or landscape → analyze for FLOOD RISK
- If it shows plants, crops, leaves, stems, or soil → analyze for PLANT DISEASE
- If it shows animals, livestock, pets, or wildlife → analyze for ANIMAL DISEASE

Respond ONLY with a single valid JSON object. No markdown, no explanation, just JSON.

For FLOOD detection:
{
  "detection_type": "flood",
  "risk_level": "Low" | "Medium" | "High" | "Very High",
  "subject": "e.g. Flash Flood Risk",
  "description": "2-3 sentences describing what you see and the flood risk",
  "symptoms": ["indicator 1", "indicator 2", "indicator 3"],
  "solutions": ["action 1", "action 2", "action 3", "action 4"],
  "prevention": ["measure 1", "measure 2", "measure 3"],
  "elevation": <number>,
  "distance_from_water": <number>
}

For PLANT DISEASE:
{
  "detection_type": "plant_disease",
  "risk_level": "Low" | "Medium" | "High" | "Critical",
  "subject": "e.g. Tomato Late Blight",
  "description": "2-3 sentences about the disease and severity",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "solutions": ["treatment 1", "treatment 2", "treatment 3", "treatment 4"],
  "prevention": ["tip 1", "tip 2", "tip 3"],
  "elevation": 0,
  "distance_from_water": 0
}

For ANIMAL DISEASE:
{
  "detection_type": "animal_disease",
  "risk_level": "Low" | "Medium" | "High" | "Critical",
  "subject": "e.g. Foot and Mouth Disease",
  "description": "2-3 sentences about the disease and severity",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "solutions": ["treatment 1", "treatment 2", "treatment 3", "treatment 4"],
  "prevention": ["tip 1", "tip 2", "tip 3"],
  "elevation": 0,
  "distance_from_water": 0
}
`;

export const COORD_PROMPT = (lat: number, lon: number) => `
You are a flood risk expert. Analyze flood risk for: latitude ${lat}, longitude ${lon}.
Consider terrain, proximity to rivers/coasts, elevation, and regional climate patterns.
Respond ONLY with a valid JSON object — no markdown, no extra text.
{
  "detection_type": "flood",
  "risk_level": "Low" | "Medium" | "High" | "Very High",
  "subject": "flood risk label for this location",
  "description": "2-3 sentences explaining the flood risk at these coordinates",
  "symptoms": ["flood risk indicator 1", "flood risk indicator 2", "flood risk indicator 3"],
  "solutions": ["action 1", "action 2", "action 3", "action 4"],
  "prevention": ["prevention measure 1", "prevention measure 2", "prevention measure 3"],
  "elevation": <estimated meters above sea level as number>,
  "distance_from_water": <estimated meters to nearest water body as number>
}
`;
