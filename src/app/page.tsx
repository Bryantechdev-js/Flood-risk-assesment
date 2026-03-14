"use client";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, ImageIcon, Leaf, Loader2, LocateIcon, MapPin, PawPrint, Shield, TrendingUp, Waves } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const FloodMap = dynamic(() => import("@/components/FloodMap"), { ssr: false });

const API_BASE = ""  // empty = relative paths, works on localhost AND Vercel

interface AnalysisResult {
  success: boolean;
  detection_type: "flood" | "plant_disease" | "animal_disease";
  risk_level: string;
  subject: string;
  description: string;
  symptoms: string[];
  solutions: string[];
  prevention: string[];
  elevation: number;
  distance_from_water: number;
  message: string;
}

const riskBadge: Record<string, string> = {
  Low:         "text-green-700 bg-green-100 border border-green-300",
  Medium:      "text-yellow-700 bg-yellow-100 border border-yellow-300",
  High:        "text-orange-700 bg-orange-100 border border-orange-300",
  "Very High": "text-red-700 bg-red-100 border border-red-300",
  Critical:    "text-red-900 bg-red-200 border border-red-500",
};

const detectionMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  flood:          { label: "Flood Risk",       color: "text-blue-600",  icon: <Waves className="h-4 w-4" /> },
  plant_disease:  { label: "Plant Disease",    color: "text-green-600", icon: <Leaf className="h-4 w-4" /> },
  animal_disease: { label: "Animal Disease",   color: "text-orange-600",icon: <PawPrint className="h-4 w-4" /> },
};

export default function Home() {
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [alert,        showAlert]       = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [isLoading,    setLoading]      = useState(false);
  const [activeTab,    setActiveTab]    = useState("coordinates");
  const [result,       setResult]       = useState<AnalysisResult | null>(null);
  const [lat,          setLat]          = useState("");
  const [lon,          setLon]          = useState("");
  const [mapCoords,    setMapCoords]    = useState<{ lat: number; lon: number } | null>(null);

  const triggerAlert = (msg: string) => { setAlertMessage(msg); showAlert(true); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 || !file.type.startsWith("image/")) {
      triggerAlert("Please upload a valid image under 10 MB.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const callApi = async (url: string, init: RequestInit): Promise<AnalysisResult> => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Server error ${res.status}` }));
      throw new Error(err.detail ?? `Server error ${res.status}`);
    }
    return res.json();
  };

  const handleAnalyzeCoordinates = async () => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (!lat || !lon || isNaN(parsedLat) || isNaN(parsedLon)) {
      triggerAlert("Please enter valid latitude and longitude values.");
      return;
    }
    setLoading(true); setResult(null);
    try {
      const data = await callApi(`${API_BASE}/api/analyze/coordinates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: parsedLat, lon: parsedLon }),
      });
      setResult(data);
      setMapCoords({ lat: parsedLat, lon: parsedLon });
    } catch (err: unknown) {
      triggerAlert(err instanceof Error ? err.message : "Failed to connect. Is the backend running on port 8000?");
    } finally { setLoading(false); }
  };

  const handleAnalyzeImage = async () => {
    if (!imageFile) { triggerAlert("Please select an image first."); return; }
    setLoading(true); setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const data = await callApi(`${API_BASE}/api/analyze/image`, { method: "POST", body: formData });
      setResult(data);
    } catch (err: unknown) {
      triggerAlert(err instanceof Error ? err.message : "Failed to connect. Is the backend running on port 8000?");
    } finally { setLoading(false); }
  };

  const meta = result ? (detectionMeta[result.detection_type] ?? detectionMeta.flood) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <Globe className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Environmental Analysis System</h1>
          </div>
          <p className="text-slate-600">
            AI-powered detection of flood risks, plant diseases, and animal diseases
          </p>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Waves className="h-3 w-3 text-blue-500" /> Flood Risk</span>
            <span className="flex items-center gap-1"><Leaf className="h-3 w-3 text-green-500" /> Plant Disease</span>
            <span className="flex items-center gap-1"><PawPrint className="h-3 w-3 text-orange-500" /> Animal Disease</span>
          </div>
        </div>

        {/* Input + Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Analysis Methods */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Analysis Input
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="coordinates" onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="coordinates" className="flex-1 flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" /> Coordinates
                  </TabsTrigger>
                  <TabsTrigger value="image" className="flex-1 flex items-center gap-1 text-xs">
                    <ImageIcon className="w-3 h-3" /> Image Scan
                  </TabsTrigger>
                </TabsList>

                {/* Coordinates Tab — flood only */}
                <TabsContent value="coordinates" className="mt-4 space-y-4">
                  <p className="text-xs text-slate-500 bg-blue-50 rounded p-2">
                    📍 Enter GPS coordinates to analyze flood risk for that location.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input type="number" id="latitude" placeholder="e.g. 5.6037"
                        value={lat} onChange={(e) => setLat(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input type="number" id="longitude" placeholder="e.g. -0.1870"
                        value={lon} onChange={(e) => setLon(e.target.value)} />
                    </div>
                  </div>
                  <Button className="w-full flex gap-2" onClick={handleAnalyzeCoordinates} disabled={isLoading}>
                    {isLoading && activeTab === "coordinates"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <LocateIcon className="w-4 h-4" />}
                    Analyze Flood Risk
                  </Button>
                </TabsContent>

                {/* Image Tab — auto-detects flood / plant / animal */}
                <TabsContent value="image" className="mt-4 space-y-4">
                  <p className="text-xs text-slate-500 bg-green-50 rounded p-2">
                    🤖 Upload any image — AI will auto-detect flood risk, plant disease, or animal disease.
                  </p>
                  <div
                    className="w-full h-44 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {!imagePreview ? (
                      <div className="text-center space-y-2 pointer-events-none">
                        <ImageIcon className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="text-slate-400 text-sm">Click to upload image</p>
                        <p className="text-slate-300 text-xs">Terrain · Plants · Animals · Max 10 MB</p>
                      </div>
                    ) : (
                      <Image src={imagePreview} alt="preview" fill className="object-cover rounded-lg" />
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*"
                      className="hidden" onChange={handleImageChange} />
                  </div>
                  {imagePreview && (
                    <button className="text-xs text-slate-400 hover:text-red-500 underline"
                      onClick={() => { setImagePreview(null); setImageFile(null); }}>
                      Remove image
                    </button>
                  )}
                  <Button className="w-full flex gap-2" onClick={handleAnalyzeImage} disabled={isLoading}>
                    {isLoading && activeTab === "image"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ImageIcon className="w-4 h-4" />}
                    Analyze with Gemini AI
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Analysis Results
                {result && meta && (
                  <span className={`ml-auto flex items-center gap-1 text-xs font-normal ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[420px]">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-slate-600 text-sm">Gemini AI is analyzing...</p>
                </div>
              )}

              {!isLoading && !result && (
                <div className="flex flex-col items-center justify-center py-16 space-y-2 text-slate-300">
                  <Shield className="h-12 w-12" />
                  <p className="text-sm">Run an analysis to see results</p>
                </div>
              )}

              {!isLoading && result && (
                <div className="space-y-4">
                  {/* Subject + Risk Badge */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800 text-base">{result.subject}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadge[result.risk_level] ?? "text-slate-600 bg-slate-100"}`}>
                      {result.risk_level}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-slate-600 text-sm leading-relaxed">{result.description}</p>

                  {/* Symptoms / Indicators */}
                  {result.symptoms.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {result.detection_type === "flood" ? "🌊 Flood Indicators" : "🔍 Observed Symptoms"}
                      </p>
                      <ul className="space-y-1">
                        {result.symptoms.map((s, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-yellow-500 shrink-0">⚠</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Solutions / Actions */}
                  {result.solutions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {result.detection_type === "flood" ? "🚨 Immediate Actions" : "💊 Treatment & Solutions"}
                      </p>
                      <ul className="space-y-1">
                        {result.solutions.map((s, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-blue-500 shrink-0 font-bold">{i + 1}.</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Prevention */}
                  {result.prevention.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        🛡 Prevention
                      </p>
                      <ul className="space-y-1">
                        {result.prevention.map((p, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-green-500 shrink-0">✓</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Flood-specific stats */}
                  {result.detection_type === "flood" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Elevation</p>
                        <p className="font-semibold text-slate-700">{result.elevation}m</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Distance from Water</p>
                        <p className="font-semibold text-slate-700">{result.distance_from_water}m</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Interactive Map — only shown for flood + coordinates */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Interactive Map
              {mapCoords && (
                <span className="text-xs font-normal text-slate-500 ml-2">
                  {mapCoords.lat.toFixed(5)}, {mapCoords.lon.toFixed(5)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full h-96">
              {mapCoords ? (
                <FloodMap lat={mapCoords.lat} lon={mapCoords.lon} riskLevel={result?.risk_level} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-3 text-slate-300 bg-slate-50">
                  <MapPin className="w-12 h-12" />
                  <p className="text-base">Enter coordinates and analyze to view map</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Alert */}
      <AlertDialog open={alert} onOpenChange={showAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notice</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="w-6 h-6 flex justify-center rounded-full items-center bg-red-600 text-white absolute right-2 top-2 cursor-pointer text-xs font-bold"
            onClick={() => showAlert(false)}>✕</div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
