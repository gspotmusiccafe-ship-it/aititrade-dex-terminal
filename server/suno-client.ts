import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SUNO_API_BASE = "https://api.sunoapi.org/api/v1";

function getApiKey(): string {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY not configured");
  return key;
}

function headers() {
  return {
    "Authorization": `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

export interface SunoGenerateOptions {
  prompt: string;
  style: string;
  title: string;
  instrumental?: boolean;
  vocalGender?: "m" | "f";
  model?: "V5" | "V4_5PLUS" | "V4_5ALL" | "V4_5" | "V4";
}

export interface SunoSongResult {
  id: string;
  audioUrl: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  title: string;
  tags: string;
  duration: number;
}

export interface SunoTaskResult {
  taskId: string;
  status: "PENDING" | "IN_PROGRESS" | "streaming" | "SUCCESS" | "FAILED";
  songs?: SunoSongResult[];
}

export async function sunoGenerate(options: SunoGenerateOptions): Promise<string> {
  const body: any = {
    customMode: true,
    model: options.model || "V4_5",
    prompt: options.prompt.slice(0, 5000),
    style: options.style.slice(0, 1000),
    title: options.title.slice(0, 80),
    instrumental: options.instrumental || false,
  };

  if (options.vocalGender) {
    body.vocalGender = options.vocalGender;
  }

  console.log(`[SUNO] Submitting generation: "${options.title}" style="${options.style}" instrumental=${options.instrumental}`);

  const res = await fetch(`${SUNO_API_BASE}/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[SUNO] API error ${res.status}: ${errorText}`);
    throw new Error(`Suno API error: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const taskId = data?.data?.taskId;
  if (!taskId) {
    console.error(`[SUNO] No taskId in response:`, JSON.stringify(data));
    throw new Error("Suno API did not return a task ID");
  }

  console.log(`[SUNO] Task submitted: ${taskId}`);
  return taskId;
}

export async function sunoCheckStatus(taskId: string): Promise<SunoTaskResult> {
  const res = await fetch(`${SUNO_API_BASE}/generate/record-info?taskId=${taskId}`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Suno status check failed: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const status = data?.data?.status || "PENDING";
  const sunoData = data?.data?.response?.sunoData;

  const songs: SunoSongResult[] = [];
  if (Array.isArray(sunoData)) {
    for (const s of sunoData) {
      songs.push({
        id: s.id || "",
        audioUrl: s.audioUrl || "",
        streamAudioUrl: s.streamAudioUrl || "",
        imageUrl: s.imageUrl || "",
        title: s.title || "",
        tags: s.tags || "",
        duration: s.duration || 0,
      });
    }
  }

  return { taskId, status, songs };
}

export async function sunoGenerateAndWait(
  options: SunoGenerateOptions,
  maxWaitMs: number = 180000
): Promise<SunoSongResult[]> {
  const taskId = await sunoGenerate(options);
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const result = await sunoCheckStatus(taskId);
    console.log(`[SUNO] Poll taskId=${taskId} status=${result.status}`);

    if (result.status === "SUCCESS" && result.songs && result.songs.length > 0) {
      console.log(`[SUNO] Generation complete: ${result.songs.length} songs ready`);
      return result.songs;
    }

    if (result.status === "FAILED") {
      throw new Error("Suno generation failed");
    }
  }

  throw new Error("Suno generation timed out");
}

export async function downloadSunoAudio(audioUrl: string, localId: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(uploadsDir, `${localId}.mp3`);
  fs.writeFileSync(filePath, buffer);

  console.log(`[SUNO] Downloaded audio to ${filePath} (${buffer.length} bytes)`);
  return `/uploads/${localId}.mp3`;
}

export function isSunoConfigured(): boolean {
  return !!process.env.SUNO_API_KEY;
}
