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
  const seed = prompt.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  let s = seed;
  const rng = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  const titleMatch = prompt.match(/"([^"]+)"/);
  const title = titleMatch ? titleMatch[1].toUpperCase() : prompt.split(" ").slice(0, 3).join(" ").toUpperCase();

  const palettes = [
    { bg1: [10, 85, 6], bg2: [280, 70, 8], accent: [142, 80, 50], glow: [142, 100, 45] },
    { bg1: [220, 80, 6], bg2: [260, 70, 10], accent: [200, 90, 55], glow: [210, 100, 50] },
    { bg1: [340, 70, 8], bg2: [20, 60, 10], accent: [45, 95, 55], glow: [30, 100, 50] },
    { bg1: [270, 75, 6], bg2: [310, 60, 10], accent: [280, 80, 60], glow: [290, 90, 55] },
    { bg1: [0, 0, 4], bg2: [160, 50, 8], accent: [142, 70, 50], glow: [160, 80, 40] },
    { bg1: [200, 80, 5], bg2: [240, 60, 12], accent: [50, 90, 55], glow: [40, 100, 50] },
  ];
  const pal = palettes[seed % palettes.length];

  const layouts = ["waveform", "geometric", "particles", "rings", "terrain"];
  const layout = layouts[Math.floor(rng() * layouts.length)];

  let elements = "";

  const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;

  if (layout === "waveform") {
    for (let w = 0; w < 5; w++) {
      const baseY = 350 + w * 70;
      const amp = 30 + rng() * 80;
      const freq = 2 + rng() * 6;
      const opacity = 0.15 + rng() * 0.25;
      let pts = "";
      for (let x = 0; x <= 1024; x += 4) {
        const y = baseY + Math.sin((x / 1024) * Math.PI * freq + w * 1.5) * amp + Math.sin((x / 1024) * Math.PI * (freq * 2.3) + w) * (amp * 0.3);
        pts += `${x},${y.toFixed(1)} `;
      }
      const waveHue = pal.accent[0] + w * 15;
      elements += `<polyline points="${pts}" fill="none" stroke="${hsl(waveHue, 70, 45 + w * 5)}" stroke-width="${1.5 + rng() * 2}" opacity="${opacity}" />`;
    }
    for (let i = 0; i < 60; i++) {
      const x = rng() * 1024;
      const y = 250 + rng() * 500;
      const r = 1 + rng() * 3;
      elements += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${hsl(pal.accent[0], 60, 50 + rng() * 30)}" opacity="${0.2 + rng() * 0.5}" />`;
    }
  } else if (layout === "geometric") {
    for (let ring = 0; ring < 6; ring++) {
      const sides = 3 + Math.floor(rng() * 6);
      const radius = 80 + ring * 55;
      const rot = rng() * 360;
      let pts = "";
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + (rot * Math.PI / 180);
        const px = 512 + Math.cos(angle) * radius;
        const py = 480 + Math.sin(angle) * radius;
        pts += `${px.toFixed(0)},${py.toFixed(0)} `;
      }
      elements += `<polygon points="${pts}" fill="none" stroke="${hsl(pal.accent[0] + ring * 20, 60, 30 + ring * 5)}" stroke-width="${1 + rng()}" opacity="${0.3 + rng() * 0.3}" />`;
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const len = 200 + rng() * 200;
      const x2 = 512 + Math.cos(angle) * len;
      const y2 = 480 + Math.sin(angle) * len;
      elements += `<line x1="512" y1="480" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${hsl(pal.accent[0], 40, 25)}" stroke-width="0.5" opacity="0.3" />`;
    }
    for (let i = 0; i < 40; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 50 + rng() * 380;
      const x = 512 + Math.cos(angle) * dist;
      const y = 480 + Math.sin(angle) * dist;
      const r = 1 + rng() * 4;
      elements += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${hsl(pal.glow[0], 80, 50 + rng() * 20)}" opacity="${0.3 + rng() * 0.5}" />`;
    }
  } else if (layout === "particles") {
    for (let i = 0; i < 200; i++) {
      const x = rng() * 1024;
      const y = rng() * 1024;
      const r = 0.5 + rng() * 5;
      const bright = 30 + rng() * 40;
      const hueShift = rng() * 60 - 30;
      elements += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${hsl(pal.accent[0] + hueShift, 60 + rng() * 30, bright)}" opacity="${0.2 + rng() * 0.6}" />`;
    }
    for (let i = 0; i < 15; i++) {
      const x = rng() * 1024;
      const y = rng() * 1024;
      const r = 20 + rng() * 80;
      elements += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${hsl(pal.glow[0], 80, 40)}" opacity="${0.03 + rng() * 0.06}" />`;
    }
    for (let i = 0; i < 8; i++) {
      const x1 = rng() * 1024; const y1 = rng() * 1024;
      const x2 = x1 + (rng() - 0.5) * 400; const y2 = y1 + (rng() - 0.5) * 400;
      elements += `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${hsl(pal.accent[0], 50, 30)}" stroke-width="0.5" opacity="0.2" />`;
    }
  } else if (layout === "rings") {
    for (let i = 0; i < 12; i++) {
      const r = 40 + i * 35;
      const sw = 0.5 + rng() * 2;
      const dash = Math.floor(4 + rng() * 20);
      const gap = Math.floor(2 + rng() * 10);
      elements += `<circle cx="512" cy="480" r="${r}" fill="none" stroke="${hsl(pal.accent[0] + i * 8, 50 + rng() * 30, 25 + i * 3)}" stroke-width="${sw.toFixed(1)}" stroke-dasharray="${dash},${gap}" opacity="${0.2 + rng() * 0.4}" />`;
    }
    for (let i = 0; i < 50; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 30 + rng() * 420;
      const x = 512 + Math.cos(angle) * dist;
      const y = 480 + Math.sin(angle) * dist;
      elements += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.5 + rng() * 2.5).toFixed(1)}" fill="${hsl(pal.glow[0], 70, 50 + rng() * 20)}" opacity="${0.3 + rng() * 0.5}" />`;
    }
  } else {
    for (let layer = 0; layer < 6; layer++) {
      let pts = `0,1024 `;
      const baseY = 900 - layer * 100;
      for (let x = 0; x <= 1024; x += 16) {
        const y = baseY - Math.sin((x / 1024) * Math.PI * (2 + rng() * 3)) * (30 + rng() * 60) - rng() * 20;
        pts += `${x},${y.toFixed(0)} `;
      }
      pts += `1024,1024`;
      const layerLight = 8 + layer * 4;
      elements += `<polygon points="${pts}" fill="${hsl(pal.accent[0] + layer * 10, 40 + layer * 5, layerLight)}" opacity="${0.4 + layer * 0.08}" />`;
    }
    for (let i = 0; i < 30; i++) {
      const x = rng() * 1024;
      const y = 50 + rng() * 400;
      const r = 0.5 + rng() * 2;
      elements += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${hsl(pal.glow[0], 60, 60)}" opacity="${0.3 + rng() * 0.5}" />`;
    }
  }

  const titleSize = title.length > 20 ? 36 : title.length > 12 ? 48 : 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${hsl(pal.bg1[0], pal.bg1[1], pal.bg1[2])}"/>
      <stop offset="50%" style="stop-color:${hsl((pal.bg1[0] + pal.bg2[0]) / 2, 60, 5)}"/>
      <stop offset="100%" style="stop-color:${hsl(pal.bg2[0], pal.bg2[1], pal.bg2[2])}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="30%" cy="30%" r="60%">
      <stop offset="0%" style="stop-color:${hsl(pal.glow[0], pal.glow[1], pal.glow[2])};stop-opacity:0.12"/>
      <stop offset="100%" style="stop-color:transparent;stop-opacity:0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="70%" cy="70%" r="50%">
      <stop offset="0%" style="stop-color:${hsl(pal.accent[0], pal.accent[1], pal.accent[2])};stop-opacity:0.08"/>
      <stop offset="100%" style="stop-color:transparent;stop-opacity:0"/>
    </radialGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${hsl(pal.accent[0], 80, 60)}"/>
      <stop offset="100%" style="stop-color:${hsl(pal.glow[0], 90, 70)}"/>
    </linearGradient>
    <filter id="textGlow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:black;stop-opacity:0.4"/>
      <stop offset="30%" style="stop-color:black;stop-opacity:0"/>
      <stop offset="70%" style="stop-color:black;stop-opacity:0"/>
      <stop offset="100%" style="stop-color:black;stop-opacity:0.5"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow1)"/>
  <rect width="1024" height="1024" fill="url(#glow2)"/>
  ${elements}
  <rect width="1024" height="1024" fill="url(#vignette)"/>
  <line x1="80" y1="140" x2="944" y2="140" stroke="${hsl(pal.accent[0], 40, 25)}" stroke-width="0.5" opacity="0.4"/>
  <text x="512" y="110" text-anchor="middle" fill="${hsl(pal.accent[0], 50, 40)}" font-family="monospace" font-size="14" letter-spacing="8" opacity="0.6">AITIFY DIGITAL ASSET EXCHANGE</text>
  <text x="512" y="512" text-anchor="middle" fill="url(#titleGrad)" font-family="monospace" font-size="${titleSize}" font-weight="bold" letter-spacing="3" filter="url(#textGlow)">${title}</text>
  <line x1="200" y1="550" x2="824" y2="550" stroke="${hsl(pal.accent[0], 50, 30)}" stroke-width="0.5" opacity="0.3"/>
  <text x="512" y="580" text-anchor="middle" fill="${hsl(pal.accent[0], 40, 40)}" font-family="monospace" font-size="16" letter-spacing="4" opacity="0.5">97.7 THE FLAME</text>
  <rect x="80" y="920" width="864" height="1" fill="${hsl(pal.accent[0], 30, 20)}" opacity="0.3"/>
  <text x="100" y="950" fill="${hsl(pal.accent[0], 30, 30)}" font-family="monospace" font-size="11" opacity="0.4">AI GENERATED ASSET</text>
  <text x="924" y="950" text-anchor="end" fill="${hsl(pal.accent[0], 30, 30)}" font-family="monospace" font-size="11" opacity="0.4">AITIFY-GEN-1</text>
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
