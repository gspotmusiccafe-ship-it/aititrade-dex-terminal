import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, Music, Image, Rocket, DollarSign, FileText, Zap, Radio, ShieldAlert, Sparkles, ArrowDown, Copy, Play, Pause, Volume2, Mic, MicOff } from "lucide-react";

interface TrustStatus {
  isMember: boolean;
  member?: {
    promissoryNoteAmount: number;
    outstandingBalance: string;
    monthlyCommitment: string;
    monthsRemaining: number;
  };
}

const VOICE_OPTIONS = [
  { value: "female-smooth", label: "FEMALE — SMOOTH R&B" },
  { value: "female-power", label: "FEMALE — POWER VOCAL" },
  { value: "female-soft", label: "FEMALE — SOFT / AIRY" },
  { value: "male-deep", label: "MALE — DEEP BARITONE" },
  { value: "male-smooth", label: "MALE — SMOOTH R&B" },
  { value: "male-raspy", label: "MALE — RASPY / GRITTY" },
  { value: "duet", label: "DUET — MALE + FEMALE" },
];

export default function ProductionPage() {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [lyricsGenre, setLyricsGenre] = useState("R&B");
  const [lyricsMood, setLyricsMood] = useState("Smooth");
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  const [generatingLyrics, setGeneratingLyrics] = useState(false);

  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioStyle, setAudioStyle] = useState("Slow Jam, 75bpm, Deep Bass, Silk Vocals, Sudden Ending, High Velocity");
  const [voiceType, setVoiceType] = useState("female-smooth");
  const [makeInstrumental, setMakeInstrumental] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedSunoId, setGeneratedSunoId] = useState<string | null>(null);
  const [generatingBeat, setGeneratingBeat] = useState(false);
  const [beatApproved, setBeatApproved] = useState(false);

  const [visualPrompt, setVisualPrompt] = useState("");
  const [generatedArtUrl, setGeneratedArtUrl] = useState<string | null>(null);
  const [generatingArt, setGeneratingArt] = useState(false);
  const [artApproved, setArtApproved] = useState(false);

  const [assetTitle, setAssetTitle] = useState("");
  const [unitPrice, setUnitPrice] = useState("25.00");

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });
  const { data: trustStatus } = useQuery<TrustStatus>({
    queryKey: ["/api/trust/status"],
  });
  const { data: kineticState } = useQuery<{ floorPct: number; ceoPct: number; splitLabel: string }>({
    queryKey: ["/api/kinetic/state"],
  });

  if (adminLoading) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center border border-red-500/30 bg-red-500/5 p-10 max-w-md">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-red-400 font-mono font-black text-xl mb-2">ACCESS DENIED</h2>
          <p className="text-red-500/60 font-mono text-xs">THIS TERMINAL IS RESTRICTED TO AUTHORIZED ADMINISTRATORS ONLY.</p>
        </div>
      </div>
    );
  }

  const noteAmount = trustStatus?.member?.promissoryNoteAmount || 500;
  const outstanding = parseFloat(trustStatus?.member?.outstandingBalance || "475.00");
  const monthly = trustStatus?.member?.monthlyCommitment || "19.79";
  const monthsLeft = trustStatus?.member?.monthsRemaining || 24;

  const voiceLabel = VOICE_OPTIONS.find(v => v.value === voiceType)?.label || voiceType;
  const voiceTag = makeInstrumental ? "" : `, ${voiceLabel.split("—")[1]?.trim() || "Smooth Vocals"}`;

  const handleGenerateLyrics = async () => {
    if (!lyricsPrompt.trim()) {
      toast({ title: "ENTER A PROMPT", description: "Describe the song you want to write", variant: "destructive" });
      return;
    }
    setGeneratingLyrics(true);
    try {
      const res = await fetch("/api/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: lyricsPrompt, genre: lyricsGenre, mood: lyricsMood }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      const data = await res.json();
      setGeneratedLyrics(data.lyrics);
      toast({ title: "LYRICS GENERATED", description: "Ready to feed into the beat machine" });
    } catch (err: any) {
      toast({ title: "LYRICS FAILED", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingLyrics(false);
    }
  };

  const feedLyricsToBeatMachine = () => {
    if (generatedLyrics) {
      setAudioPrompt(generatedLyrics);
      setBeatApproved(false);
      setGeneratedAudioUrl(null);
      toast({ title: "LYRICS LOADED INTO BEAT MACHINE" });
    }
  };

  const handleGenerateBeat = async () => {
    if (!audioPrompt.trim() && !assetTitle.trim()) {
      toast({ title: "ENTER LYRICS OR PROMPT", variant: "destructive" });
      return;
    }
    setGeneratingBeat(true);
    setBeatApproved(false);
    setGeneratedAudioUrl(null);
    try {
      const fullPrompt = audioPrompt || assetTitle;
      const fullStyle = `${audioStyle}${voiceTag}`;
      const res = await fetch("/api/production/generate-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          style: fullStyle,
          voiceType,
          makeInstrumental,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Beat generation failed");
      }
      const data = await res.json();
      setGeneratedAudioUrl(data.audioUrl || null);
      setGeneratedSunoId(data.sunoId || null);
      toast({ title: "BEAT GENERATED", description: data.audioUrl ? "Preview ready — listen and approve" : "Beat queued — check back shortly" });
    } catch (err: any) {
      toast({ title: "BEAT GENERATION FAILED", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingBeat(false);
    }
  };

  const handleGenerateArt = async () => {
    setGeneratingArt(true);
    setArtApproved(false);
    setGeneratedArtUrl(null);
    try {
      const res = await fetch("/api/production/generate-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: visualPrompt || `Cinematic trading floor style album art for "${assetTitle || "AI Trade Beat"}", neon green and obsidian, high-tech digital asset style`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Art generation failed");
      }
      const data = await res.json();
      setGeneratedArtUrl(data.imageUrl || null);
      toast({ title: "ARTWORK GENERATED", description: "Preview ready — approve before pushing" });
    } catch (err: any) {
      toast({ title: "ART GENERATION FAILED", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingArt(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/production/push", {
        title: assetTitle,
        audioPrompt: audioPrompt || assetTitle,
        visualPrompt: visualPrompt || undefined,
        style: `${audioStyle}${voiceTag}`,
        unitPrice: parseFloat(unitPrice),
        makeInstrumental,
        preGeneratedAudioUrl: generatedAudioUrl,
        preGeneratedSunoId: generatedSunoId,
        preGeneratedArtUrl: generatedArtUrl,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setAssetTitle("");
      setAudioPrompt("");
      setVisualPrompt("");
      setGeneratedLyrics("");
      setLyricsPrompt("");
      setGeneratedAudioUrl(null);
      setGeneratedArtUrl(null);
      setBeatApproved(false);
      setArtApproved(false);
      setGeneratedSunoId(null);
      toast({
        title: "ASSET PUSHED TO GLOBAL FLOOR",
        description: `${data.assetTicker} LIVE — $${data.pricing?.wholesaleCost || 0.38} debited. Balance: $${data.ledger?.newBalance}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trust/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
    },
    onError: (err: any) => {
      toast({ title: "PUSH FAILED", description: err.message || "Pipeline error", variant: "destructive" });
    },
  });

  const isPushing = pushMutation.isPending;
  const canPush = assetTitle.trim().length > 0;

  return (
    <div className="min-h-full bg-black pb-36">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="border-2 border-green-600 bg-zinc-950 shadow-2xl shadow-green-900/20">
          <div className="border-b border-green-600/50 bg-green-900/10 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-black text-2xl italic uppercase underline font-mono tracking-tight" data-testid="text-production-title">
                MINT FACTORY
              </h2>
              <p className="text-green-500/60 text-[10px] font-mono mt-1">ADMIN-ONLY ASSET PRODUCTION & DISTRIBUTION TERMINAL</p>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-green-500 animate-pulse" />
              <span className="text-green-500 text-[10px] font-mono font-extrabold">97.7 THE FLAME</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-4 bg-black border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-zinc-500 text-[10px] uppercase font-bold font-mono">Ledger Status</p>
                {trustStatus?.isMember ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
              </div>
              <p className="text-green-500 font-mono font-black text-sm" data-testid="text-ledger-status">
                ${noteAmount.toFixed(2)} NOTE SIGNED // $25 ACTIVATED
              </p>
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div className="border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                  <p className="text-zinc-600 text-[8px] font-mono">OUTSTANDING</p>
                  <p className="text-green-400 text-xs font-mono font-extrabold">${outstanding.toFixed(2)}</p>
                </div>
                <div className="border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                  <p className="text-zinc-600 text-[8px] font-mono">MONTHLY</p>
                  <p className="text-green-400 text-xs font-mono font-extrabold">${monthly}</p>
                </div>
                <div className="border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                  <p className="text-zinc-600 text-[8px] font-mono">MONTHS LEFT</p>
                  <p className="text-green-400 text-xs font-mono font-extrabold">{monthsLeft}</p>
                </div>
                <div className="border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                  <p className="text-zinc-600 text-[8px] font-mono">COST/ASSET</p>
                  <p className="text-green-400 text-xs font-mono font-extrabold">$0.38</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-violet-600/50 bg-violet-950/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h3 className="text-violet-300 font-mono font-black text-lg uppercase">STEP 1 — AI LYRICS GENERATOR</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">SONG CONCEPT / PROMPT</label>
                  <textarea
                    value={lyricsPrompt}
                    onChange={(e) => setLyricsPrompt(e.target.value)}
                    placeholder="Describe the song... (e.g. 'A smooth R&B love song about building wealth together')"
                    className="w-full bg-black border border-violet-700/50 p-3 text-white text-sm font-mono h-20 resize-none focus:border-violet-400 focus:outline-none"
                    data-testid="textarea-lyrics-prompt"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">GENRE</label>
                    <input type="text" value={lyricsGenre} onChange={(e) => setLyricsGenre(e.target.value)}
                      className="w-full bg-black border border-violet-700/50 p-2 text-violet-300 text-sm font-mono focus:border-violet-400 focus:outline-none"
                      data-testid="input-lyrics-genre" />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">MOOD</label>
                    <input type="text" value={lyricsMood} onChange={(e) => setLyricsMood(e.target.value)}
                      className="w-full bg-black border border-violet-700/50 p-2 text-violet-300 text-sm font-mono focus:border-violet-400 focus:outline-none"
                      data-testid="input-lyrics-mood" />
                  </div>
                </div>
                <button type="button" onClick={handleGenerateLyrics} disabled={generatingLyrics || !lyricsPrompt.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-mono font-black py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  data-testid="button-generate-lyrics">
                  {generatingLyrics ? <><Loader2 className="h-4 w-4 animate-spin" /> GENERATING LYRICS...</> : <><Sparkles className="h-4 w-4" /> GENERATE LYRICS (AI)</>}
                </button>
                {generatedLyrics && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-violet-400 text-[10px] font-mono font-bold">GENERATED LYRICS:</p>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(generatedLyrics); toast({ title: "Copied!" }); }}
                        className="text-zinc-500 hover:text-violet-400 text-[9px] font-mono flex items-center gap-1" data-testid="button-copy-lyrics">
                        <Copy className="h-3 w-3" /> COPY
                      </button>
                    </div>
                    <pre className="bg-black border border-violet-700/30 p-4 text-violet-200 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto" data-testid="text-generated-lyrics">
                      {generatedLyrics}
                    </pre>
                    <button type="button" onClick={feedLyricsToBeatMachine}
                      className="w-full bg-green-700 hover:bg-green-600 text-white font-mono font-black py-3 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-green-500/30"
                      data-testid="button-feed-to-beat">
                      <ArrowDown className="h-4 w-4" /> FEED LYRICS TO VOCAL PERFORMER
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-2 border-green-600/50 bg-green-950/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Music className="h-5 w-5 text-green-400" />
                <h3 className="text-green-300 font-mono font-black text-lg uppercase">STEP 2 — VOCAL PERFORMANCE (AI)</h3>
                <span className="text-zinc-600 text-[9px] font-mono ml-auto">$0.35/TRACK</span>
              </div>

              <div className="mb-4">
                <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-2">VOCAL TYPE</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VOICE_OPTIONS.map((v) => (
                    <button key={v.value} type="button"
                      onClick={() => { setVoiceType(v.value); if (v.value !== "duet") setMakeInstrumental(false); }}
                      className={`text-[9px] font-mono font-bold py-2 px-2 border transition-all ${voiceType === v.value
                        ? "border-green-500 bg-green-900/40 text-green-300"
                        : "border-zinc-700 text-zinc-500 hover:border-green-700 hover:text-green-400"}`}
                      data-testid={`button-voice-${v.value}`}>
                      {v.value.startsWith("female") ? <span className="text-pink-400 mr-1">&#9792;</span> : v.value.startsWith("male") ? <span className="text-blue-400 mr-1">&#9794;</span> : <span className="text-purple-400 mr-1">&#9892;</span>}
                      {v.label}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setMakeInstrumental(true); setVoiceType("female-smooth"); }}
                    className={`text-[9px] font-mono font-bold py-2 px-2 border transition-all ${makeInstrumental
                      ? "border-yellow-500 bg-yellow-900/40 text-yellow-300"
                      : "border-zinc-700 text-zinc-500 hover:border-yellow-700 hover:text-yellow-400"}`}
                    data-testid="button-voice-instrumental">
                    <MicOff className="h-3 w-3 inline mr-1" /> INSTRUMENTAL (NO VOCALS)
                  </button>
                </div>
                <p className="text-green-600 text-[9px] font-mono mt-2">
                  SELECTED: {makeInstrumental ? "INSTRUMENTAL — NO VOCALS" : voiceLabel}
                </p>
              </div>

              <textarea value={audioPrompt} onChange={(e) => { setAudioPrompt(e.target.value); setBeatApproved(false); setGeneratedAudioUrl(null); }}
                placeholder="Paste lyrics here... Lyrics from Step 1 auto-fill when you click 'Feed'. AI will sing/perform these with your selected voice and style."
                className="w-full bg-black border border-green-700/50 p-3 text-white text-sm font-mono h-32 resize-none focus:border-green-400 focus:outline-none"
                data-testid="textarea-audio-prompt" />

              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1">
                  <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">STYLE TAGS</label>
                  <input type="text" value={audioStyle} onChange={(e) => setAudioStyle(e.target.value)}
                    className="w-full bg-black border border-green-700/50 p-2 text-green-400 text-xs font-mono focus:border-green-400 focus:outline-none"
                    data-testid="input-audio-style" />
                </div>
              </div>

              <button type="button" onClick={handleGenerateBeat} disabled={generatingBeat || (!audioPrompt.trim() && !assetTitle.trim())}
                className="w-full mt-4 bg-green-700 hover:bg-green-600 text-white font-mono font-black py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] border border-green-500/30"
                data-testid="button-generate-beat">
                {generatingBeat ? <><Loader2 className="h-4 w-4 animate-spin" /> GENERATING VOCAL...</> : <><Music className="h-4 w-4" /> GENERATE VOCAL PERFORMANCE</>}
              </button>

              {generatedAudioUrl && (
                <div className="mt-4 p-4 border border-green-600/40 bg-green-950/30">
                  <p className="text-green-400 text-[10px] font-mono font-bold mb-3">PREVIEW YOUR VOCAL:</p>
                  <div className="flex items-center gap-3 mb-3">
                    <button type="button" onClick={togglePlayback}
                      className="bg-green-600 hover:bg-green-500 text-black p-3 transition-all active:scale-95"
                      data-testid="button-play-preview">
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <div className="flex-1">
                      <audio ref={audioRef} src={generatedAudioUrl} onEnded={() => setIsPlaying(false)}
                        className="w-full" controls data-testid="audio-beat-preview" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setBeatApproved(true); toast({ title: "BEAT APPROVED" }); }}
                      className={`flex-1 py-2 font-mono font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${beatApproved ? "bg-green-500 text-black" : "bg-green-800 hover:bg-green-700 text-white border border-green-500/30"}`}
                      data-testid="button-approve-beat">
                      <CheckCircle2 className="h-4 w-4" /> {beatApproved ? "BEAT APPROVED" : "APPROVE THIS BEAT"}
                    </button>
                    <button type="button" onClick={() => { setGeneratedAudioUrl(null); setBeatApproved(false); setGeneratedSunoId(null); toast({ title: "Rejected — generate again" }); }}
                      className="px-4 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 font-mono font-bold text-sm transition-all"
                      data-testid="button-reject-beat">
                      REJECT
                    </button>
                  </div>
                </div>
              )}

              {!generatedAudioUrl && generatedSunoId && (
                <div className="mt-3 p-3 border border-yellow-700/30 bg-yellow-950/20 text-center">
                  <p className="text-yellow-400 text-[10px] font-mono font-bold">BEAT QUEUED — SUNO ID: {generatedSunoId}</p>
                  <p className="text-zinc-500 text-[9px] font-mono">Audio is being generated. Check back shortly or re-generate.</p>
                </div>
              )}
            </div>

            <div className="border-2 border-amber-600/50 bg-amber-950/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Image className="h-5 w-5 text-amber-400" />
                <h3 className="text-amber-300 font-mono font-black text-lg uppercase">STEP 3 — ARTWORK (IDEOGRAM v2)</h3>
                <span className="text-zinc-600 text-[9px] font-mono ml-auto">$0.03/IMAGE</span>
              </div>
              <textarea value={visualPrompt} onChange={(e) => { setVisualPrompt(e.target.value); setArtApproved(false); setGeneratedArtUrl(null); }}
                placeholder="Describe the album art style... (auto-generates from title if empty)"
                className="w-full bg-black border border-amber-700/50 p-3 text-white text-sm font-mono h-20 resize-none focus:border-amber-400 focus:outline-none"
                data-testid="textarea-visual-prompt" />

              <button type="button" onClick={handleGenerateArt} disabled={generatingArt}
                className="w-full mt-3 bg-amber-700 hover:bg-amber-600 text-white font-mono font-black py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] border border-amber-500/30"
                data-testid="button-generate-art">
                {generatingArt ? <><Loader2 className="h-4 w-4 animate-spin" /> GENERATING ARTWORK...</> : <><Image className="h-4 w-4" /> GENERATE ARTWORK</>}
              </button>

              {generatedArtUrl && (
                <div className="mt-4 p-4 border border-amber-600/40 bg-amber-950/30">
                  <p className="text-amber-400 text-[10px] font-mono font-bold mb-3">PREVIEW ARTWORK:</p>
                  <img src={generatedArtUrl} alt="Generated artwork" className="w-full max-w-xs mx-auto border border-amber-700/30" data-testid="img-generated-artwork" />
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => { setArtApproved(true); toast({ title: "ARTWORK APPROVED" }); }}
                      className={`flex-1 py-2 font-mono font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${artApproved ? "bg-amber-500 text-black" : "bg-amber-800 hover:bg-amber-700 text-white border border-amber-500/30"}`}
                      data-testid="button-approve-art">
                      <CheckCircle2 className="h-4 w-4" /> {artApproved ? "ART APPROVED" : "APPROVE THIS ART"}
                    </button>
                    <button type="button" onClick={() => { setGeneratedArtUrl(null); setArtApproved(false); toast({ title: "Rejected — generate again" }); }}
                      className="px-4 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 font-mono font-bold text-sm transition-all"
                      data-testid="button-reject-art">
                      REJECT
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-2 border-green-500 bg-green-950/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="h-5 w-5 text-green-400" />
                <h3 className="text-green-300 font-mono font-black text-lg uppercase">STEP 4 — PUSH TO FLOOR</h3>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">ASSET TITLE (REQUIRED)</label>
                  <input type="text" value={assetTitle} onChange={(e) => setAssetTitle(e.target.value)}
                    placeholder="Enter asset title..."
                    className="w-full bg-black border border-green-700/50 p-3 text-white text-sm font-mono focus:border-green-400 focus:outline-none"
                    data-testid="input-asset-title" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">UNIT PRICE ($)</label>
                    <input type="text" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                      className="w-full bg-black border border-green-700/50 p-2 text-green-400 text-sm font-mono focus:border-green-400 focus:outline-none"
                      data-testid="input-unit-price" />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                      <p className="text-zinc-600 text-[8px] font-mono">WHOLESALE COST</p>
                      <p className="text-green-400 text-sm font-mono font-extrabold">$0.38</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-black border border-zinc-800 mb-4">
                <p className="text-zinc-500 text-[10px] uppercase font-bold font-mono mb-2">APPROVAL STATUS</p>
                <div className="flex gap-6 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5">
                    {generatedLyrics ? <CheckCircle2 className="h-3 w-3 text-violet-500" /> : <div className="h-3 w-3 border border-zinc-600" />}
                    <span className={generatedLyrics ? "text-violet-400 font-extrabold" : "text-zinc-600"}>LYRICS</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {beatApproved ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <div className="h-3 w-3 border border-zinc-600" />}
                    <span className={beatApproved ? "text-green-400 font-extrabold" : "text-zinc-600"}>BEAT {beatApproved ? "APPROVED" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {artApproved ? <CheckCircle2 className="h-3 w-3 text-amber-500" /> : <div className="h-3 w-3 border border-zinc-600" />}
                    <span className={artApproved ? "text-amber-400 font-extrabold" : "text-zinc-600"}>ART {artApproved ? "APPROVED" : ""}</span>
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => pushMutation.mutate()} disabled={isPushing || !canPush}
                className="w-full bg-green-600 py-4 text-white font-black text-xl hover:bg-green-400 transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]"
                data-testid="button-push-to-floor">
                {isPushing ? <><Loader2 className="h-5 w-5 animate-spin" /> PUSHING TO FLOOR...</> : <><Rocket className="h-5 w-5" /> PUSH TO GLOBAL FLOOR</>}
              </button>
              <p className="text-center text-zinc-600 text-[9px] font-mono mt-2">
                AI VOCAL ($0.35) + DALL-E ART ($0.03) + FLOOR LISTING — KINETIC SPLIT ACTIVE
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <Zap className="h-4 w-4 text-green-500/40 mx-auto mb-1" />
                <p className="text-zinc-500 text-[9px] font-mono font-bold">{kineticState?.floorPct ?? 54}% FLOOR</p>
                <p className="text-green-400 text-xs font-mono font-extrabold">${(parseFloat(unitPrice || "0") * ((kineticState?.floorPct ?? 54) / 100)).toFixed(2)}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <DollarSign className="h-4 w-4 text-green-500/40 mx-auto mb-1" />
                <p className="text-zinc-500 text-[9px] font-mono font-bold">{kineticState?.ceoPct ?? 46}% CEO</p>
                <p className="text-green-400 text-xs font-mono font-extrabold">${(parseFloat(unitPrice || "0") * ((kineticState?.ceoPct ?? 46) / 100)).toFixed(2)}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <Radio className="h-4 w-4 text-green-500/40 mx-auto mb-1" />
                <p className="text-zinc-500 text-[9px] font-mono font-bold">TRUST TITHE</p>
                <p className="text-green-400 text-xs font-mono font-extrabold">${(parseFloat(unitPrice || "0") * ((kineticState?.ceoPct ?? 46) / 100) * 0.10).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
