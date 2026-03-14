from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from dotenv import load_dotenv
from PIL import Image as PILImage
from google import genai
from google.genai import types
import uvicorn
import logging
import json
import re
import io
import os
import time

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = "gemini-2.5-flash-lite"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Environmental Analysis System",
    description="AI-powered flood, plant disease, and animal disease detection using Gemini",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class CoordinatesRequest(BaseModel):
    lat: float
    lon: float

class AnalysisResponse(BaseModel):
    success: bool
    detection_type: str          # "flood" | "plant_disease" | "animal_disease"
    risk_level: str              # Low / Medium / High / Very High / Critical
    subject: str                 # what was detected e.g. "Tomato Late Blight", "Flash Flood Risk"
    description: str
    symptoms: list[str]          # visible symptoms / flood indicators observed
    solutions: list[str]         # treatments / flood actions
    prevention: list[str]        # how to prevent recurrence
    # flood-specific (empty for disease)
    elevation: float
    distance_from_water: float
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set in .env")
    return genai.Client(api_key=GEMINI_API_KEY)


def call_gemini(client: genai.Client, contents, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            return client.models.generate_content(model=GEMINI_MODEL, contents=contents).text
        except Exception as e:
            if "429" in str(e) and attempt < retries - 1:
                wait = 2 ** attempt
                logger.warning(f"Rate limited — retrying in {wait}s")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("Gemini call failed after retries")


def parse_response(raw: str) -> dict:
    try:
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            d = json.loads(match.group())
            return {
                "detection_type":      d.get("detection_type", "flood"),
                "risk_level":          d.get("risk_level", "Medium"),
                "subject":             d.get("subject", "Unknown"),
                "description":         d.get("description", ""),
                "symptoms":            d.get("symptoms", []),
                "solutions":           d.get("solutions", []),
                "prevention":          d.get("prevention", []),
                "elevation":           float(d.get("elevation", 0.0)),
                "distance_from_water": float(d.get("distance_from_water", 0.0)),
            }
    except Exception as e:
        logger.error(f"Parse error: {e} | raw: {raw[:300]}")
    return {
        "detection_type": "flood", "risk_level": "Medium",
        "subject": "Analysis incomplete", "description": raw[:300],
        "symptoms": [], "solutions": [], "prevention": [],
        "elevation": 0.0, "distance_from_water": 0.0,
    }


# ── Prompts ───────────────────────────────────────────────────────────────────

IMAGE_PROMPT = """
You are an expert environmental analyst specializing in flood risk assessment,
plant pathology, and veterinary disease detection.

Look at this image carefully and determine what it shows:
- If it shows terrain, water, flooding, or landscape → analyze for FLOOD RISK
- If it shows plants, crops, leaves, stems, or soil → analyze for PLANT DISEASE
- If it shows animals, livestock, pets, or wildlife → analyze for ANIMAL DISEASE

Respond ONLY with a single valid JSON object. No markdown, no explanation, just JSON.

For FLOOD detection use:
{
  "detection_type": "flood",
  "risk_level": "Low" | "Medium" | "High" | "Very High",
  "subject": "brief flood risk label e.g. Flash Flood Risk / Coastal Flooding",
  "description": "2-3 sentences describing what you see and the flood risk",
  "symptoms": ["flood indicator 1", "flood indicator 2", "flood indicator 3"],
  "solutions": ["immediate action 1", "immediate action 2", "immediate action 3", "immediate action 4"],
  "prevention": ["prevention measure 1", "prevention measure 2", "prevention measure 3"],
  "elevation": <estimated meters above sea level as number>,
  "distance_from_water": <estimated meters to nearest water body as number>
}

For PLANT DISEASE detection use:
{
  "detection_type": "plant_disease",
  "risk_level": "Low" | "Medium" | "High" | "Critical",
  "subject": "disease name e.g. Tomato Late Blight / Maize Rust / Root Rot",
  "description": "2-3 sentences describing the disease, affected plant, and severity",
  "symptoms": ["visible symptom 1", "visible symptom 2", "visible symptom 3"],
  "solutions": ["treatment step 1", "treatment step 2", "treatment step 3", "treatment step 4"],
  "prevention": ["prevention tip 1", "prevention tip 2", "prevention tip 3"],
  "elevation": 0,
  "distance_from_water": 0
}

For ANIMAL DISEASE detection use:
{
  "detection_type": "animal_disease",
  "risk_level": "Low" | "Medium" | "High" | "Critical",
  "subject": "disease name e.g. Foot and Mouth Disease / Newcastle Disease / Mange",
  "description": "2-3 sentences describing the disease, affected animal, and severity",
  "symptoms": ["visible symptom 1", "visible symptom 2", "visible symptom 3"],
  "solutions": ["treatment step 1", "treatment step 2", "treatment step 3", "treatment step 4"],
  "prevention": ["prevention tip 1", "prevention tip 2", "prevention tip 3"],
  "elevation": 0,
  "distance_from_water": 0
}
"""

COORD_PROMPT_TEMPLATE = """
You are a flood risk expert. Analyze flood risk for: latitude {lat}, longitude {lon}.
Consider terrain, proximity to rivers/coasts, elevation, and regional climate patterns.
Respond ONLY with a valid JSON object — no markdown, no extra text.
{{
  "detection_type": "flood",
  "risk_level": "Low" | "Medium" | "High" | "Very High",
  "subject": "flood risk label for this location",
  "description": "2-3 sentences explaining the flood risk at these coordinates",
  "symptoms": ["flood risk indicator 1", "flood risk indicator 2", "flood risk indicator 3"],
  "solutions": ["action 1", "action 2", "action 3", "action 4"],
  "prevention": ["prevention measure 1", "prevention measure 2", "prevention measure 3"],
  "elevation": <estimated meters above sea level as number>,
  "distance_from_water": <estimated meters to nearest water body as number>
}}
"""


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "Environmental Analysis API is running",
        "version": "2.0.0",
        "model": GEMINI_MODEL,
        "capabilities": ["flood detection", "plant disease", "animal disease"],
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/analyze/image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """Auto-detect flood risk, plant disease, or animal disease from an image."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")

    image_data = await file.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10 MB.")

    try:
        pil_img = PILImage.open(io.BytesIO(image_data))
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        img_bytes = buf.getvalue()
    except Exception as e:
        logger.error(f"Image conversion error: {e}")
        raise HTTPException(status_code=400, detail="Could not process image file.")

    logger.info(f"Sending image to Gemini ({len(img_bytes)} bytes)")

    try:
        client = get_client()
        raw = call_gemini(client, contents=[
            types.Part.from_text(text=IMAGE_PROMPT),
            types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
        ])
        logger.info(f"Gemini response: {raw[:200]}")
        parsed = parse_response(raw)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        raise HTTPException(status_code=503, detail=f"Gemini AI error: {str(e)[:300]}")

    return AnalysisResponse(
        success=True,
        detection_type=parsed["detection_type"],
        risk_level=parsed["risk_level"],
        subject=parsed["subject"],
        description=parsed["description"],
        symptoms=parsed["symptoms"],
        solutions=parsed["solutions"],
        prevention=parsed["prevention"],
        elevation=parsed["elevation"],
        distance_from_water=parsed["distance_from_water"],
        message=f"Analysis complete: {parsed['detection_type'].replace('_', ' ').title()} detected.",
    )


@app.post("/api/analyze/coordinates", response_model=AnalysisResponse)
async def analyze_coordinates(request: CoordinatesRequest):
    """Analyze flood risk based on GPS coordinates."""

    logger.info(f"Analyzing coordinates: lat={request.lat}, lon={request.lon}")
    prompt = COORD_PROMPT_TEMPLATE.format(lat=request.lat, lon=request.lon)

    try:
        client = get_client()
        raw = call_gemini(client, contents=prompt)
        logger.info(f"Gemini response: {raw[:200]}")
        parsed = parse_response(raw)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        raise HTTPException(status_code=503, detail=f"Gemini AI error: {str(e)[:300]}")

    return AnalysisResponse(
        success=True,
        detection_type="flood",
        risk_level=parsed["risk_level"],
        subject=parsed["subject"],
        description=parsed["description"],
        symptoms=parsed["symptoms"],
        solutions=parsed["solutions"],
        prevention=parsed["prevention"],
        elevation=parsed["elevation"],
        distance_from_water=parsed["distance_from_water"],
        message="Coordinate flood analysis completed.",
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True, log_level="info")
