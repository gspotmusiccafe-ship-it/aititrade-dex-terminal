import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SONIC_API_BASE = "https://api.musicapi.ai/api/v1/sonic";

function getApiKey(): string {
  const key = process.env.SONIC_API_KEY || process.env.SUNO_API_KEY;
  if (!key) throw new Error("SONIC_API_KEY not configured");
  return key;
}

function headers() {
  return {
    "Authorization": `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

export interface SonicGenerateOptions {
  prompt: string;
  tags: string;
  title: string;
  instrumental?: boolean;
  model?: "sonic-v4-5" | "sonic-v4" | "sonic-v3-5";
}

export interface SonicSongResult {
  id: string;
  audioUrl: string;
  streamUrl?: string;
  imageUrl?: string;
  title: string;
  tags: string;
  duration: number;
  status: string;
}

export interface SonicTaskResult {
  taskId: string;
  status: "PENDING" | "IN_PROGRESS" | "streaming" | "SUCCESS" | "FAILED" | "complete";
  songs?: SonicSongResult[];
}

export async function sonicGenerate(options: SonicGenerateOptions): Promise<string> {
  const body: any = {
    custom_mode: true,
    mv: options.model || "sonic-v4-5",
    title: options.title.slice(0, 80),
    tags: options.tags.slice(0, 1000),
    prompt: options.prompt.slice(0, 5000),
  };

  if (options.instrumental) {
    body.instrumental = true;
  }

  console.log(`[SONIC] Submitting generation: "${options.title}" tags="${options.tags}" model=${body.mv}`);

  const res = await fetch(`${SONIC_API_BASE}/create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[SONIC] API error ${res.status}: ${errorText}`);
    throw new Error(`Sonic API error: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const taskId = data?.data?.taskId || data?.taskId || data?.id;
  if (!taskId) {
    console.error(`[SONIC] No taskId in response:`, JSON.stringify(data));
    throw new Error("Sonic API did not return a task ID");
  }

  console.log(`[SONIC] Task submitted: ${taskId}`);
  return taskId;
}

export async function sonicCheckStatus(taskId: string): Promise<SonicTaskResult> {
  const res = await fetch(`${SONIC_API_BASE}/task?taskId=${taskId}`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Sonic status check failed: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  const taskData = data?.data || data;
  const status = taskData?.status || "PENDING";

  const songs: SonicSongResult[] = [];
  const clips = taskData?.clips || taskData?.response?.clips || taskData?.songs || [];

  if (Array.isArray(clips)) {
    for (const s of clips) {
      if (s.audioUrl || s.audio_url || s.stream_url) {
        songs.push({
          id: s.id || s.clip_id || "",
          audioUrl: s.audioUrl || s.audio_url || "",
          streamUrl: s.streamUrl || s.stream_url || "",
          imageUrl: s.imageUrl || s.image_url || "",
          title: s.title || "",
          tags: s.tags || s.metadata?.tags || "",
          duration: s.duration || 0,
          status: s.status || status,
        });
      }
    }
  }

  return { taskId, status, songs };
}

export async function sonicGenerateAndWait(
  options: SonicGenerateOptions,
  maxWaitMs: number = 180000
): Promise<SonicSongResult[]> {
  const taskId = await sonicGenerate(options);
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const result = await sonicCheckStatus(taskId);
    console.log(`[SONIC] Poll taskId=${taskId} status=${result.status} songs=${result.songs?.length || 0}`);

    if ((result.status === "SUCCESS" || result.status === "complete") && result.songs && result.songs.length > 0) {
      console.log(`[SONIC] Generation complete: ${result.songs.length} songs ready`);
      return result.songs;
    }

    if (result.status === "FAILED") {
      throw new Error("Sonic generation failed");
    }
  }

  throw new Error("Sonic generation timed out");
}

export async function downloadSonicAudio(audioUrl: string, localId: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(uploadsDir, `${localId}.mp3`);
  fs.writeFileSync(filePath, buffer);

  console.log(`[SONIC] Downloaded audio to ${filePath} (${buffer.length} bytes)`);
  return `/uploads/${localId}.mp3`;
}

export function isSonicConfigured(): boolean {
  return !!(process.env.SONIC_API_KEY || process.env.SUNO_API_KEY);
}
