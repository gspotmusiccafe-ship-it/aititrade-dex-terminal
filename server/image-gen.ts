import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const KIE_API_KEY = process.env.KIE_AI_API_KEY;

const KIE_JOBS_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";

export interface ArtGenerateOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  style?: string;
}

export interface ArtResult {
  imageUrl: string;
  localPath: string;
  engine: string;
}

async function tryKieIdeogram(options: ArtGenerateOptions): Promise<ArtResult | null> {
  if (!KIE_API_KEY) return null;

  try {
    const submitRes = await fetch(KIE_JOBS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "ideogram/v3",
        callBackUrl: "https://localhost/callback",
        input: {
          prompt: options.prompt,
          style: options.style || "AUTO",
          rendering_speed: "BALANCED",
          image_size: "square_hd",
          num_images: "1",
          negative_prompt: options.negativePrompt || "blur, low quality, watermark, text",
          expand_prompt: true,
        },
      }),
    });

    const submitData: any = await submitRes.json();
    if (submitData?.code !== 200 || !submitData?.data?.taskId) {
      console.log(`[ART/KIE] Ideogram not available: ${submitData?.msg}`);
      return null;
    }

    const taskId = submitData.data.taskId;
    console.log(`[ART/KIE] Ideogram task: ${taskId}`);

    const maxWait = 120000;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 5000));

      const statusRes = await fetch(`${KIE_STATUS_URL}?taskId=${taskId}`, {
        headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
      });
      const statusData: any = await statusRes.json();
      const status = statusData?.data?.status;

      if (status === "SUCCESS") {
        const imageUrl = statusData?.data?.response?.data?.[0]?.url
          || statusData?.data?.response?.imageUrl
          || statusData?.data?.output?.[0]
          || null;
        if (imageUrl) {
          const localPath = await downloadImage(imageUrl, `art-kie-${Date.now()}`);
          return { imageUrl, localPath, engine: "ideogram-v3" };
        }
        return null;
      }
      if (status === "FAILED") {
        console.log(`[ART/KIE] Ideogram task failed`);
        return null;
      }
    }
    return null;
  } catch (e: any) {
    console.log(`[ART/KIE] Ideogram error: ${e.message}`);
    return null;
  }
}

async function tryOpenAIProxy(options: ArtGenerateOptions): Promise<ArtResult | null> {
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "unused",
      baseURL: "http://localhost:1106/modelfarm/openai",
    });

    const result = await client.images.generate({
      model: "dall-e-3",
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    const imageUrl = result.data?.[0]?.url;
    if (imageUrl) {
      const localPath = await downloadImage(imageUrl, `art-dalle-${Date.now()}`);
      return { imageUrl, localPath, engine: "dall-e-3" };
    }
    return null;
  } catch (e: any) {
    console.log(`[ART/DALLE] Not available: ${e.message}`);
    return null;
  }
}

async function tryPlaceholderArt(options: ArtGenerateOptions): Promise<ArtResult> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const id = `art-gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const svgContent = generateArtSVG(options.prompt);
  const filePath = path.join(uploadsDir, `${id}.svg`);
  fs.writeFileSync(filePath, svgContent);

  console.log(`[ART/SVG] Generated placeholder artwork: ${filePath}`);
  return {
    imageUrl: `/uploads/${id}.svg`,
    localPath: `/uploads/${id}.svg`,
    engine: "svg-generator",
  };
}

function generateArtSVG(prompt: string): string {
  const words = prompt.split(" ").slice(0, 4).join(" ").toUpperCase();
  const seed = prompt.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = seed % 360;
  const hue2 = (seed * 7) % 360;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue1},70%,8%)"/>
      <stop offset="100%" style="stop-color:hsl(${hue2},60%,12%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:hsl(${hue1},100%,50%);stop-opacity:0.15"/>
      <stop offset="100%" style="stop-color:transparent;stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="400" fill="url(#glow)"/>
  <text x="512" y="480" text-anchor="middle" fill="hsl(${hue1},80%,60%)" font-family="monospace" font-size="42" font-weight="bold" opacity="0.9">${words}</text>
  <text x="512" y="540" text-anchor="middle" fill="hsl(142,70%,50%)" font-family="monospace" font-size="28" font-weight="bold" opacity="0.6">AITIFY DEX</text>
  <line x1="200" y1="600" x2="824" y2="600" stroke="hsl(${hue1},60%,40%)" stroke-width="1" opacity="0.3"/>
  <text x="512" y="640" text-anchor="middle" fill="#555" font-family="monospace" font-size="14">AI GENERATED ASSET</text>
</svg>`;
}

async function downloadImage(url: string, id: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = url.includes(".png") ? "png" : url.includes(".svg") ? "svg" : "jpg";
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  fs.writeFileSync(filePath, buffer);

  console.log(`[ART] Downloaded to ${filePath} (${buffer.length} bytes)`);
  return `/uploads/${id}.${ext}`;
}

export async function generateArtwork(options: ArtGenerateOptions): Promise<ArtResult> {
  console.log(`[ART] Generating artwork: "${options.prompt.slice(0, 60)}..."`);

  const kieResult = await tryKieIdeogram(options);
  if (kieResult) {
    console.log(`[ART] Ideogram success: ${kieResult.localPath}`);
    return kieResult;
  }

  const dalleResult = await tryOpenAIProxy(options);
  if (dalleResult) {
    console.log(`[ART] DALL-E success: ${dalleResult.localPath}`);
    return dalleResult;
  }

  console.log(`[ART] Falling back to SVG placeholder`);
  return tryPlaceholderArt(options);
}

export function isArtConfigured(): boolean {
  return true;
}
