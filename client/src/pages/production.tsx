import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, Music, Image, Rocket, DollarSign, FileText, Zap, Radio, ShieldAlert, Sparkles, ArrowDown, Copy } from "lucide-react";

interface TrustStatus {
  isMember: boolean;
  member?: {
    promissoryNoteAmount: number;
    outstandingBalance: string;
    monthlyCommitment: string;
    monthsRemaining: number;
  };
}

interface GenerationResult {
  status: string;
  suno_id?: string;
  imageUrl?: string;
  ticker?: string;
  title?: string;
  wholesale_cost?: number;
}

export default function ProductionPage() {
  const { toast } = useToast();
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [lyricsGenre, setLyricsGenre] = useState("R&B");
  const [lyricsMood, setLyricsMood] = useState("Smooth");
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioStyle, setAudioStyle] = useState("Slow Jam, 75bpm, Deep Bass, Silk Vocals, Sudden Ending, High Velocity");
  const [makeInstrumental, setMakeInstrumental] = useState(false);
  const [visualPrompt, setVisualPrompt] = useState("");
  const [assetTitle, setAssetTitle] = useState("");
  const [unitPrice, setUnitPrice] = useState("25.00");
  const [audioResult, setAudioResult] = useState<GenerationResult | null>(null);
  const [visualResult, setVisualResult] = useState<GenerationResult | null>(null);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatingArt, setGeneratingArt] = useState(false);

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: trustStatus } = useQuery<TrustStatus>({
    queryKey: ["/api/trust/status"],
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
      toast({ title: "LYRICS LOADED INTO BEAT MACHINE", description: "Lyrics fed into Suno prompt — ready to generate" });
    }
  };

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/production/push", {
        title: assetTitle,
        audioPrompt: audioPrompt || assetTitle,
        visualPrompt: visualPrompt || undefined,
        style: audioStyle,
        unitPrice: parseFloat(unitPrice),
        makeInstrumental,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setAudioResult(data.audio ? { status: data.audio.status, suno_id: data.audio.suno_id } : null);
      setVisualResult(data.artwork ? { status: data.artwork.status, imageUrl: data.artwork.imageUrl } : null);
      setAssetTitle("");
      setAudioPrompt("");
      setVisualPrompt("");
      setGeneratedLyrics("");
      setLyricsPrompt("");
      toast({
        title: "ASSET PUSHED TO GLOBAL FLOOR",
        description: `${data.assetTicker} LIVE — $${data.pricing?.wholesaleCost || 0.38} debited from trust note. Balance: $${data.ledger?.newBalance}`,
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
                {trustStatus?.isMember ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
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
                    className="w-full bg-black border border-violet-700/50 p-3 text-white text-sm font-mono h-20 resize-none focus:border-violet-400 focus:outline-none transition-colors"
                    data-testid="textarea-lyrics-prompt"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">GENRE</label>
                    <input
                      type="text"
                      value={lyricsGenre}
                      onChange={(e) => setLyricsGenre(e.target.value)}
                      className="w-full bg-black border border-violet-700/50 p-2 text-violet-300 text-sm font-mono focus:border-violet-400 focus:outline-none"
                      data-testid="input-lyrics-genre"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">MOOD</label>
                    <input
                      type="text"
                      value={lyricsMood}
                      onChange={(e) => setLyricsMood(e.target.value)}
                      className="w-full bg-black border border-violet-700/50 p-2 text-violet-300 text-sm font-mono focus:border-violet-400 focus:outline-none"
                      data-testid="input-lyrics-mood"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateLyrics}
                  disabled={generatingLyrics || !lyricsPrompt.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-mono font-black py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  data-testid="button-generate-lyrics"
                >
                  {generatingLyrics ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> GENERATING LYRICS...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> GENERATE LYRICS (AI)</>
                  )}
                </button>
                {generatedLyrics && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-violet-400 text-[10px] font-mono font-bold">GENERATED LYRICS:</p>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(generatedLyrics); toast({ title: "Copied!" }); }}
                        className="text-zinc-500 hover:text-violet-400 text-[9px] font-mono flex items-center gap-1"
                        data-testid="button-copy-lyrics"
                      >
                        <Copy className="h-3 w-3" /> COPY
                      </button>
                    </div>
                    <pre className="bg-black border border-violet-700/30 p-4 text-violet-200 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto" data-testid="text-generated-lyrics">
                      {generatedLyrics}
                    </pre>
                    <button
                      type="button"
                      onClick={feedLyricsToBeatMachine}
                      className="w-full bg-green-700 hover:bg-green-600 text-white font-mono font-black py-3 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-green-500/30"
                      data-testid="button-feed-to-beat"
                    >
                      <ArrowDown className="h-4 w-4" /> FEED LYRICS INTO BEAT MACHINE
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-2 border-green-600/50 bg-green-950/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Music className="h-5 w-5 text-green-400" />
                <h3 className="text-green-300 font-mono font-black text-lg uppercase">STEP 2 — BEAT MACHINE (SUNO v3.5)</h3>
                <span className="text-zinc-600 text-[9px] font-mono ml-auto">$0.35/TRACK</span>
              </div>
              <textarea
                value={audioPrompt}
                onChange={(e) => setAudioPrompt(e.target.value)}
                placeholder="Paste lyrics here or describe the beat... Lyrics from Step 1 will auto-fill when you click 'Feed to Beat Machine'"
                className="w-full bg-black border border-green-700/50 p-3 text-white text-sm font-mono h-32 resize-none focus:border-green-400 focus:outline-none transition-colors"
                data-testid="textarea-audio-prompt"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">STYLE TAGS</label>
                    <input
                      type="text"
                      value={audioStyle}
                      onChange={(e) => setAudioStyle(e.target.value)}
                      className="bg-black border border-green-700/50 p-2 text-green-400 text-xs font-mono w-80 focus:border-green-400 focus:outline-none"
                      data-testid="input-audio-style"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={makeInstrumental}
                      onChange={(e) => setMakeInstrumental(e.target.checked)}
                      className="accent-green-500"
                      data-testid="checkbox-instrumental"
                    />
                    <span className="text-zinc-400 text-[9px] font-mono font-bold">INSTRUMENTAL ONLY</span>
                  </label>
                </div>
                {audioResult && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              {audioPrompt.trim() && (
                <p className="text-green-600 text-[9px] font-mono mt-2">
                  {audioPrompt.length} CHARS LOADED — {makeInstrumental ? "INSTRUMENTAL" : "VOCAL"} MODE
                </p>
              )}
            </div>

            <div className="border-2 border-amber-600/50 bg-amber-950/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Image className="h-5 w-5 text-amber-400" />
                <h3 className="text-amber-300 font-mono font-black text-lg uppercase">STEP 3 — ARTWORK (IDEOGRAM v2)</h3>
                <span className="text-zinc-600 text-[9px] font-mono ml-auto">$0.03/IMAGE</span>
              </div>
              <textarea
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                placeholder="Describe the album art style... (auto-generates from title if empty)"
                className="w-full bg-black border border-amber-700/50 p-3 text-white text-sm font-mono h-20 resize-none focus:border-amber-400 focus:outline-none transition-colors"
                data-testid="textarea-visual-prompt"
              />
              {visualResult?.imageUrl && (
                <div className="mt-3 border border-amber-700/30 overflow-hidden">
                  <img
                    src={visualResult.imageUrl}
                    alt="Generated artwork"
                    className="w-full h-40 object-cover"
                    data-testid="img-generated-artwork"
                  />
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
                  <input
                    type="text"
                    value={assetTitle}
                    onChange={(e) => setAssetTitle(e.target.value)}
                    placeholder="Enter asset title..."
                    className="w-full bg-black border border-green-700/50 p-3 text-white text-sm font-mono focus:border-green-400 focus:outline-none transition-colors"
                    data-testid="input-asset-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">UNIT PRICE ($)</label>
                    <input
                      type="text"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="w-full bg-black border border-green-700/50 p-2 text-green-400 text-sm font-mono focus:border-green-400 focus:outline-none"
                      data-testid="input-unit-price"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                      <p className="text-zinc-600 text-[8px] font-mono">WHOLESALE COST</p>
                      <p className="text-green-400 text-sm font-mono font-extrabold">$0.38</p>
                    </div>
                  </div>
                </div>
              </div>

              {(audioResult || visualResult) && (
                <div className="p-3 bg-black border border-green-600/30 mb-4">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold font-mono mb-2">Pipeline Status</p>
                  <div className="flex gap-6 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      {audioResult ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <div className="h-3 w-3 border border-zinc-600" />}
                      <span className={audioResult ? "text-green-400 font-extrabold" : "text-zinc-600"}>SUNO AUDIO</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {visualResult ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <div className="h-3 w-3 border border-zinc-600" />}
                      <span className={visualResult ? "text-green-400 font-extrabold" : "text-zinc-600"}>IDEOGRAM ART</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 border border-zinc-600" />
                      <span className="text-zinc-600">FLOOR LISTING</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => pushMutation.mutate()}
                disabled={isPushing || !canPush}
                className="w-full bg-green-600 py-4 text-white font-black text-xl hover:bg-green-400 transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]"
                data-testid="button-push-to-floor"
              >
                {isPushing ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> PUSHING TO FLOOR...</>
                ) : (
                  <><Rocket className="h-5 w-5" /> GENERATE + PUSH TO GLOBAL FLOOR</>
                )}
              </button>
              <p className="text-center text-zinc-600 text-[9px] font-mono mt-2">
                SUNO AUDIO ($0.35) + IDEOGRAM ART ($0.03) + FLOOR LISTING — 54/46 SPLIT ACTIVE
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <Zap className="h-4 w-4 text-green-500/40 mx-auto mb-1" />
                <p className="text-zinc-500 text-[9px] font-mono font-bold">54% FLOOR</p>
                <p className="text-green-400 text-xs font-mono font-extrabold">${(parseFloat(unitPrice || "0") * 0.54).toFixed(2)}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <DollarSign className="h-4 w-4 text-green-500/40 mx-auto mb-1" />
                <p className="text-zinc-500 text-[9px] font-mono font-bold">46% CEO</p>
                <p className="text-green-400 text-xs font-mono font-extrabold">${(parseFloat(unitPrice || "0") * 0.46).toFixed(2)}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <Radio className="h-4 w-4 text-green-500/40 mx-auto mb-1" />
                <p className="text-zinc-500 text-[9px] font-mono font-bold">TRUST TITHE</p>
                <p className="text-green-400 text-xs font-mono font-extrabold">${(parseFloat(unitPrice || "0") * 0.46 * 0.10).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
