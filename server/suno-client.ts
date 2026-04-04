import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const KIE_SUBMIT_URL = "https://api.kie.ai/v1/suno/submit";
const KIE_FETCH_URL = "https://api.kie.ai/v1/suno/fetch/";

const LEGACY_SUNO_API_BASE = "https://api.sunoapi.org/api/v1";

function getKieApiKey(): string | null {
  return process.env.KIE_AI_API_KEY || null;
}

function getLegacyApiKey(): string | null {
  return process.env.SUNO_API_KEY || null;
}

function kieHeaders() {
  return {
    "Authorization": `Bearer ${getKieApiKey()}`,
    "Content-Type": "application/json",
  };
}

function legacyHeaders() {
  return {
    "Authorization": `Bearer ${getLegacyApiKey()}`,
    "Content-Type": "application/json",
  };
}

export interface SunoGenerateOptions {
  prompt: string;
  style: string;
  title: string;
  instrumental?: boolean;
  vocalGender?: "m" | "f";
  model?: "V5" | "V4_5PLUS" | "V4_5ALL" | "V4_5" | "V4" | "chirp-v3-5";
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

async function kieSubmit(options: SunoGenerateOptions): Promise<string> {
  const body: any = {
    prompt: options.prompt.slice(0, 5000),
    tags: options.style.slice(0, 1000),
    mv: options.model || "chirp-v3-5",
    make_instrumental: options.instrumental || false,
  };

  if (options.title) {
    body.title = options.title.slice(0, 80);
  }

  console.log(`[SUNO/KIE] Submitting: "${options.title}" tags="${options.style}" instrumental=${options.instrumental}`);

  const res = await fetch(KIE_SUBMIT_URL, {
    method: "POST",
    headers: kieHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[SUNO/KIE] API error ${res.status}: ${errorText}`);
    throw new Error(`Kie AI API error: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const taskId = data?.data?.task_id;
  if (!taskId) {
    console.error(`[SUNO/KIE] No task_id in response:`, JSON.stringify(data));
    throw new Error("Kie AI API did not return a task ID");
  }

  console.log(`[SUNO/KIE] Task submitted: ${taskId}`);
  return taskId;
}

async function kieCheckStatus(taskId: string): Promise<SunoTaskResult> {
  const res = await fetch(`${KIE_FETCH_URL}${taskId}`, {
    method: "GET",
    headers: kieHeaders(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Kie AI status check failed: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const taskData = data?.data;
  const status = taskData?.status || "PENDING";

  const songs: SunoSongResult[] = [];

  if (status === "SUCCESS") {
    if (taskData?.audio_url) {
      songs.push({
        id: taskId,
        audioUrl: taskData.audio_url,
        streamAudioUrl: taskData.stream_audio_url || taskData.audio_url,
        imageUrl: taskData.image_url || "",
        title: taskData.title || "",
        tags: taskData.tags || "",
        duration: taskData.duration || 0,
      });
    }

    if (Array.isArray(taskData?.clips)) {
      for (const clip of taskData.clips) {
        songs.push({
          id: clip.id || taskId,
          audioUrl: clip.audio_url || "",
          streamAudioUrl: clip.stream_audio_url || clip.audio_url || "",
          imageUrl: clip.image_url || "",
          title: clip.title || "",
          tags: clip.tags || "",
          duration: clip.duration || 0,
        });
      }
    }
  }

  const mappedStatus = status === "SUCCESS" ? "SUCCESS"
    : status === "FAILED" ? "FAILED"
    : status === "PROCESSING" || status === "IN_PROGRESS" ? "IN_PROGRESS"
    : "PENDING";

  return { taskId, status: mappedStatus as any, songs };
}

async function legacySubmit(options: SunoGenerateOptions): Promise<string> {
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

  console.log(`[SUNO/LEGACY] Submitting: "${options.title}" style="${options.style}"`);

  const res = await fetch(`${LEGACY_SUNO_API_BASE}/generate`, {
    method: "POST",
    headers: legacyHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Legacy Suno API error: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const taskId = data?.data?.taskId;
  if (!taskId) throw new Error("Legacy Suno API did not return a task ID");

  console.log(`[SUNO/LEGACY] Task submitted: ${taskId}`);
  return taskId;
}

async function legacyCheckStatus(taskId: string): Promise<SunoTaskResult> {
  const res = await fetch(`${LEGACY_SUNO_API_BASE}/generate/record-info?taskId=${taskId}`, {
    method: "GET",
    headers: legacyHeaders(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Legacy Suno status check failed: ${res.status} - ${errorText}`);
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

function useKie(): boolean {
  return !!getKieApiKey();
}

export async function sunoGenerate(options: SunoGenerateOptions): Promise<string> {
  if (useKie()) {
    return kieSubmit(options);
  }
  if (getLegacyApiKey()) {
    return legacySubmit(options);
  }
  throw new Error("No Suno API key configured (KIE_AI_API_KEY or SUNO_API_KEY)");
}

export async function sunoCheckStatus(taskId: string): Promise<SunoTaskResult> {
  if (useKie()) {
    return kieCheckStatus(taskId);
  }
  return legacyCheckStatus(taskId);
}

export async function sunoGenerateAndWait(
  options: SunoGenerateOptions,
  maxWaitMs: number = 180000
): Promise<SunoSongResult[]> {
  const taskId = await sunoGenerate(options);
  const startTime = Date.now();
  const pollInterval = 10000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const result = await sunoCheckStatus(taskId);
    console.log(`[SUNO] Poll taskId=${taskId} status=${result.status} songs=${result.songs?.length || 0}`);

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
  return !!getKieApiKey() || !!getLegacyApiKey();
}

export function getSunoEngine(): string {
  if (getKieApiKey()) return "kie-ai";
  if (getLegacyApiKey()) return "suno-legacy";
  return "none";
}
