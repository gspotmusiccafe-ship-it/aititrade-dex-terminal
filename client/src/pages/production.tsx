import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, Music, Image, Rocket, DollarSign, FileText, Zap, Radio } from "lucide-react";

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
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioStyle, setAudioStyle] = useState("Global Trade Beat");
  const [makeInstrumental, setMakeInstrumental] = useState(false);
  const [visualPrompt, setVisualPrompt] = useState("");
  const [assetTitle, setAssetTitle] = useState("");
  const [unitPrice, setUnitPrice] = useState("25.00");
  const [step, setStep] = useState<"compose" | "review" | "pushing">("compose");

  const [audioResult, setAudioResult] = useState<GenerationResult | null>(null);
  const [visualResult, setVisualResult] = useState<GenerationResult | null>(null);

  const { data: trustStatus } = useQuery<TrustStatus>({
    queryKey: ["/api/trust/status"],
  });

  const noteAmount = trustStatus?.member?.promissoryNoteAmount || 500;
  const outstanding = parseFloat(trustStatus?.member?.outstandingBalance || "475.00");
  const monthly = trustStatus?.member?.monthlyCommitment || "19.79";
  const monthsLeft = trustStatus?.member?.monthsRemaining || 24;

  const sunoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/suno-generate", {
        prompt: audioPrompt || assetTitle,
        style: audioStyle,
        makeInstrumental,
      });
    },
    onSuccess: (data: any) => {
      setAudioResult(data);
      toast({ title: "AUDIO GENERATED", description: `Suno asset created — $0.35 lent to trust` });
    },
    onError: (err: any) => {
      toast({ title: "AUDIO GENERATION FAILED", description: err.message || "Check SUNO_API_KEY", variant: "destructive" });
    },
  });

  const ideogramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/ideogram-generate", {
        trackTitle: assetTitle,
        customPrompt: visualPrompt || undefined,
        aspectRatio: "1:1",
      });
    },
    onSuccess: (data: any) => {
      setVisualResult(data);
      toast({ title: "ARTWORK GENERATED", description: `Ideogram visual created — $0.03 lent to trust` });
    },
    onError: (err: any) => {
      toast({ title: "ART GENERATION FAILED", description: err.message || "Check IDEOGRAM_API_KEY", variant: "destructive" });
    },
  });

  const directPushMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/distribute/direct-push", {
        title: assetTitle,
        prompt: audioPrompt || assetTitle,
        style: audioStyle,
        price: parseFloat(unitPrice),
        makeInstrumental,
        aspectRatio: "1:1",
      });
    },
    onSuccess: (data: any) => {
      setStep("compose");
      setAudioPrompt("");
      setVisualPrompt("");
      setAssetTitle("");
      setAudioResult(null);
      setVisualResult(null);
      toast({
        title: "ASSET PUSHED TO GLOBAL FLOOR",
        description: `${data.ticker || assetTitle} is now LIVE on 97.7 THE FLAME — $0.38 wholesale`,
      });
    },
    onError: (err: any) => {
      toast({ title: "PUSH FAILED", description: err.message || "Pipeline error", variant: "destructive" });
    },
  });

  const isGenerating = sunoMutation.isPending || ideogramMutation.isPending;
  const isPushing = directPushMutation.isPending;
  const canPush = assetTitle.trim().length > 0;

  return (
    <div className="min-h-full bg-black pb-36">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="border-2 border-green-600 bg-zinc-950 shadow-2xl shadow-green-900/20">
          <div className="border-b border-green-600/50 bg-green-900/10 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-black text-2xl italic uppercase underline font-mono tracking-tight" data-testid="text-production-title">
                Asset Production & Distribution
              </h2>
              <p className="text-green-500/60 text-[10px] font-mono mt-1">SOVEREIGN EXCHANGE PRODUCTION TERMINAL</p>
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

            <div className="p-4 bg-black border border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5 text-green-500" />
                <p className="text-zinc-500 text-[10px] uppercase font-bold font-mono">Asset Identity</p>
              </div>
              <input
                type="text"
                value={assetTitle}
                onChange={(e) => setAssetTitle(e.target.value)}
                placeholder="Asset Title (required)"
                className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-sm font-mono focus:border-green-500 focus:outline-none transition-colors"
                data-testid="input-asset-title"
              />
              <div className="flex gap-3 mt-3">
                <div className="flex-1">
                  <label className="text-zinc-600 text-[9px] font-mono block mb-1">UNIT PRICE ($)</label>
                  <input
                    type="text"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 p-2 text-green-400 text-sm font-mono focus:border-green-500 focus:outline-none"
                    data-testid="input-unit-price"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-zinc-600 text-[9px] font-mono block mb-1">STYLE TAG</label>
                  <input
                    type="text"
                    value={audioStyle}
                    onChange={(e) => setAudioStyle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 p-2 text-green-400 text-sm font-mono focus:border-green-500 focus:outline-none"
                    data-testid="input-audio-style"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Music className="h-3.5 w-3.5 text-green-500" />
                    <label className="text-white text-xs font-bold uppercase font-mono">Audio Prompt (Suno v3.5)</label>
                  </div>
                  {audioResult && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>
                <textarea
                  value={audioPrompt}
                  onChange={(e) => setAudioPrompt(e.target.value)}
                  placeholder="Describe the trade beat..."
                  className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-sm font-mono h-24 resize-none focus:border-green-500 focus:outline-none transition-colors"
                  data-testid="textarea-audio-prompt"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-zinc-500 text-[9px] font-mono font-bold">COST: $0.35 LENT TO TRUST</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makeInstrumental}
                      onChange={(e) => setMakeInstrumental(e.target.checked)}
                      className="accent-green-500"
                      data-testid="checkbox-instrumental"
                    />
                    <span className="text-zinc-400 text-[9px] font-mono">INSTRUMENTAL</span>
                  </label>
                </div>
                <button
                  onClick={() => sunoMutation.mutate()}
                  disabled={sunoMutation.isPending || !canPush}
                  className="w-full mt-3 bg-zinc-800 border border-green-600/30 text-green-400 text-[10px] font-mono font-extrabold py-2 hover:bg-green-900/20 hover:border-green-500/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="button-generate-audio"
                >
                  {sunoMutation.isPending ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> GENERATING AUDIO...</>
                  ) : audioResult ? (
                    <><CheckCircle2 className="h-3 w-3" /> AUDIO READY — REGENERATE</>
                  ) : (
                    <><Music className="h-3 w-3" /> GENERATE AUDIO — $0.35</>
                  )}
                </button>
              </div>

              <div className="p-4 bg-black border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Image className="h-3.5 w-3.5 text-green-500" />
                    <label className="text-white text-xs font-bold uppercase font-mono">Visual Identity (Ideogram)</label>
                  </div>
                  {visualResult && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>
                <textarea
                  value={visualPrompt}
                  onChange={(e) => setVisualPrompt(e.target.value)}
                  placeholder="Asset artwork style... (auto-generates from title if empty)"
                  className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white text-sm font-mono h-24 resize-none focus:border-green-500 focus:outline-none transition-colors"
                  data-testid="textarea-visual-prompt"
                />
                <span className="text-zinc-500 text-[9px] font-mono font-bold">COST: $0.03 LENT TO TRUST</span>
                <button
                  onClick={() => ideogramMutation.mutate()}
                  disabled={ideogramMutation.isPending || !canPush}
                  className="w-full mt-3 bg-zinc-800 border border-green-600/30 text-green-400 text-[10px] font-mono font-extrabold py-2 hover:bg-green-900/20 hover:border-green-500/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="button-generate-visual"
                >
                  {ideogramMutation.isPending ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> GENERATING ARTWORK...</>
                  ) : visualResult ? (
                    <><CheckCircle2 className="h-3 w-3" /> ARTWORK READY — REGENERATE</>
                  ) : (
                    <><Image className="h-3 w-3" /> GENERATE ARTWORK — $0.03</>
                  )}
                </button>

                {visualResult?.imageUrl && (
                  <div className="mt-3 border border-zinc-700 overflow-hidden">
                    <img
                      src={visualResult.imageUrl}
                      alt="Generated artwork"
                      className="w-full h-32 object-cover"
                      data-testid="img-generated-artwork"
                    />
                  </div>
                )}
              </div>
            </div>

            {(audioResult || visualResult) && (
              <div className="p-4 bg-black border border-green-600/30">
                <p className="text-zinc-500 text-[10px] uppercase font-bold font-mono mb-3">Pipeline Status</p>
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

            <div className="border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-white text-xs font-mono font-extrabold">WHOLESALE PRODUCTION COST</p>
                    <p className="text-zinc-500 text-[9px] font-mono">AUDIO $0.35 + ART $0.03 = $0.38 LENT TO TRUST NOTE</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-green-400 text-lg font-mono font-black">$0.38</p>
                  <p className="text-zinc-600 text-[8px] font-mono">PER ASSET</p>
                </div>
              </div>

              <button
                onClick={() => directPushMutation.mutate()}
                disabled={isPushing || !canPush}
                className="w-full bg-green-600 py-4 text-white font-black text-xl hover:bg-green-400 transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                data-testid="button-push-to-floor"
              >
                {isPushing ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> PUSHING TO FLOOR...</>
                ) : (
                  <><Rocket className="h-5 w-5" /> PUSH TO GLOBAL FLOOR (97.7 THE FLAME)</>
                )}
              </button>
              <p className="text-center text-zinc-600 text-[9px] font-mono mt-2">
                FULL PIPELINE: SUNO AUDIO + IDEOGRAM ART + FLOOR LISTING — 54/46 SPLIT ACTIVE
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
