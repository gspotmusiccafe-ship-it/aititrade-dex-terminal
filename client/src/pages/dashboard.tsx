import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronUp, Crown, Shield, Building2, FileText, CreditCard, Landmark, TrendingUp, Award, Briefcase, Scale, BadgeCheck, Target, ScrollText } from "lucide-react";
import { BLUEVINE_MINT_URL, BLUEVINE_TRUST_URL } from "@/lib/checkout-config";
import { TrustCertificate } from "@/components/trust-certificate";
import type { CreditStep } from "@shared/schema";

const STEPS = [
  {
    number: 1,
    title: "ENTITY SETUP",
    subtitle: "Form Your Business Entity",
    icon: Building2,
    description: "Register your LLC or Corporation with your state. This is the legal foundation of your business credit profile. Choose your entity type, file articles of organization, and obtain your state registration documents.",
    details: [
      "Choose LLC or Corporation structure",
      "File Articles of Organization / Incorporation with your state",
      "Obtain Certificate of Good Standing",
      "Register a dedicated business address (no P.O. Box)",
      "Set up a dedicated business phone line (411 listed)",
    ],
  },
  {
    number: 2,
    title: "EIN / DUNS REGISTRATION",
    subtitle: "Federal & Credit Bureau IDs",
    icon: FileText,
    description: "Obtain your Federal Employer Identification Number (EIN) from the IRS and register for a D-U-N-S Number with Dun & Bradstreet. These are required for all business credit applications.",
    details: [
      "Apply for EIN at irs.gov (free, instant)",
      "Register for D-U-N-S Number at dnb.com (free)",
      "Verify your business listing with D&B",
      "Ensure NAP consistency (Name, Address, Phone) across all registrations",
      "Set up your D&B business profile",
    ],
  },
  {
    number: 3,
    title: "TIER 1 TRADE LINES",
    subtitle: "Starter Vendor Accounts",
    icon: CreditCard,
    description: "Open Net-30 vendor accounts that report to business credit bureaus. These starter trade lines build your initial payment history. Focus on vendors that report to Dun & Bradstreet, Experian Business, and Equifax Business.",
    details: [
      "Open 3-5 Net-30 vendor accounts (Uline, Grainger, Quill, Crown Office)",
      "Make small purchases on each account",
      "Pay ALL invoices before the due date",
      "Verify each vendor reports to D&B, Experian, or Equifax",
      "Build 3+ months of on-time payment history",
    ],
  },
  {
    number: 4,
    title: "BUSINESS BANK ACCOUNT",
    subtitle: "Separate Business Banking",
    icon: Landmark,
    description: "Open a dedicated business checking account. Never commingle personal and business funds. A business bank account strengthens your credit profile and is required for most credit applications.",
    details: [
      "Open business checking at a major bank or credit union",
      "Deposit initial capital and maintain consistent balance",
      "Set up online banking and bill pay",
      "Use this account for ALL business transactions",
      "Maintain average daily balance above $2,000",
    ],
  },
  {
    number: 5,
    title: "BUSINESS CREDIT MONITORING",
    subtitle: "Track Your Credit Profile",
    icon: TrendingUp,
    description: "Set up monitoring with all three business credit bureaus. Track your Paydex score (D&B), Intelliscore (Experian), and Business Credit Risk Score (Equifax).",
    details: [
      "Register for D&B CreditMonitor",
      "Set up Experian Business Credit Advantage",
      "Monitor Equifax Business Credit Report",
      "Target: Paydex 80+ within 90 days",
      "Dispute any inaccuracies immediately",
    ],
  },
  {
    number: 6,
    title: "TIER 2 TRADE LINES",
    subtitle: "Revolving Store Credit",
    icon: CreditCard,
    description: "Apply for revolving store credit cards that report to business bureaus. These build higher credit limits and show revolving credit management.",
    details: [
      "Apply for store cards: Staples, Home Depot, Lowe's, Amazon Business",
      "Keep utilization below 30% on each card",
      "Pay statement balance in full each month",
      "Request credit limit increases every 6 months",
      "Build 6+ months of revolving credit history",
    ],
  },
  {
    number: 7,
    title: "BUSINESS INSURANCE",
    subtitle: "Liability & Professional Coverage",
    icon: Shield,
    description: "Obtain general liability insurance and any industry-specific coverage. Insurance demonstrates business stability and is often required for larger credit lines.",
    details: [
      "General Liability Insurance ($1M minimum)",
      "Professional Liability / E&O Insurance",
      "Workers Comp (if applicable)",
      "Keep certificates of insurance current",
      "Insurance history strengthens credit applications",
    ],
  },
  {
    number: 8,
    title: "TIER 3 — FLEET & FUEL CARDS",
    subtitle: "Specialized Business Credit",
    icon: Briefcase,
    description: "Apply for fleet and fuel cards that report to business credit bureaus. These demonstrate industry-specific creditworthiness and typically offer higher limits.",
    details: [
      "Apply for WEX Fleet Card or Shell Business Card",
      "Obtain Fuelman or Comdata fuel card",
      "Maintain on-time payments consistently",
      "Use for legitimate business fuel/fleet expenses",
      "These cards accelerate Paydex and Intelliscore growth",
    ],
  },
  {
    number: 9,
    title: "BUSINESS CREDIT CARDS",
    subtitle: "Major Unsecured Business Cards",
    icon: CreditCard,
    description: "Apply for major business credit cards (Amex Business, Chase Ink, Capital One Spark). These provide significant credit lines and build your profile with all three bureaus.",
    details: [
      "American Express Business Gold or Platinum",
      "Chase Ink Business Preferred or Unlimited",
      "Capital One Spark Cash or Miles",
      "Target combined limits of $50K+",
      "Maintain utilization below 20%",
    ],
  },
  {
    number: 10,
    title: "BUSINESS LINE OF CREDIT",
    subtitle: "Revolving Credit Facility",
    icon: Scale,
    description: "Secure a business line of credit from a bank or online lender. This provides flexible access to capital and signals strong creditworthiness to future lenders.",
    details: [
      "Apply at your primary business bank first",
      "Consider Bluevine, Kabbage, or OnDeck for online options",
      "Target $25K-$100K initial line",
      "Draw and repay strategically to build history",
      "Renegotiate terms and limits annually",
    ],
  },
  {
    number: 11,
    title: "SBA LOAN READINESS",
    subtitle: "Government-Backed Financing",
    icon: BadgeCheck,
    description: "Prepare your business for SBA loan qualification. This includes organizing financials, building relationships with SBA-preferred lenders, and ensuring your credit profile meets SBA standards.",
    details: [
      "Organize 2+ years of business tax returns",
      "Prepare profit & loss statements and balance sheets",
      "Build relationship with SBA-preferred lender",
      "Target SBA 7(a) or 504 loan programs",
      "Paydex 80+, personal credit 680+ typically required",
    ],
  },
  {
    number: 12,
    title: "CREDIT PORTFOLIO OPTIMIZATION",
    subtitle: "Scale & Maintain Your Profile",
    icon: Target,
    description: "Continuously optimize your business credit portfolio. Maintain all accounts, request limit increases, diversify credit types, and leverage your strong credit for growth capital.",
    details: [
      "Annual review of all credit lines and limits",
      "Request limit increases on all accounts",
      "Maintain Paydex 80+ and Intelliscore 76+",
      "Diversify: trade lines, revolving, installment, LOC",
      "Leverage strong profile for $250K+ in funding access",
    ],
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cert") === "1") {
      setShowCertificate(true);
      params.delete("cert");
      const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: !!user,
  });

  const { data: membership } = useQuery<{ tier: string; isActive: boolean; trustInvestor?: boolean; startDate?: string; createdAt?: string }>({
    queryKey: ["/api/user/membership"],
    enabled: !!user,
  });

  const isAdmin = !!adminCheck?.isAdmin;
  const isMintor = isAdmin || membership?.tier === "mintor" || membership?.tier === "mint_factory_ceo";
  const isTrustee = isAdmin || !!membership?.trustInvestor;

  interface RoyaltyPoolData {
    currentTrustValuation: number;
    trustVaultRate: string;
    userShare: number;
    totalGlobalSales: number;
    trustVaultAmount: number;
  }

  const { data: royaltyPool } = useQuery<RoyaltyPoolData>({
    queryKey: ["/api/royalty-pool"],
    enabled: !!user && isTrustee,
  });

  const { data: stepData, isLoading } = useQuery<CreditStep[]>({
    queryKey: ["/api/credit-steps"],
    enabled: !!user,
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ stepNumber, status }: { stepNumber: number; status: string }) => {
      return apiRequest("POST", "/api/credit-steps/update", { stepNumber, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-steps"] });
      toast({
        title: "✦ STEP UPDATED",
        description: "Credit module progress saved.",
      });
    },
  });

  const getStepStatus = (stepNumber: number): string => {
    if (!stepData) return "locked";
    const step = stepData.find((s) => s.stepNumber === stepNumber);
    return step?.status || "locked";
  };

  const cycleStatus = (stepNumber: number) => {
    const current = getStepStatus(stepNumber);
    const next = current === "locked" ? "in_progress" : current === "in_progress" ? "completed" : "locked";
    updateStepMutation.mutate({ stepNumber, status: next });
  };

  const completedCount = stepData?.filter((s) => s.status === "completed").length || 0;
  const inProgressCount = stepData?.filter((s) => s.status === "in_progress").length || 0;
  const progressPercent = Math.round((completedCount / 12) * 100);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
          <p className="text-lime-400 font-mono text-xs font-extrabold">LOADING CEO CLASS MODULE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="border border-lime-500/30 bg-black mb-6">
          <div className="bg-lime-500/10 border-b border-lime-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-lime-400" />
              <div>
                <h1 className="text-lg font-extrabold text-lime-400 tracking-tight" data-testid="text-ceo-class-title">CEO CLASS — 12-STEP BUSINESS CREDIT PROGRAM</h1>
                <p className="text-[10px] text-lime-400/60 font-bold">AITIFY SOVEREIGN EXCHANGE — CREDIT BUILDING MODULE</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-lime-400 font-extrabold">{progressPercent}% COMPLETE</p>
              <p className="text-[10px] text-zinc-500">{completedCount}/12 STEPS</p>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-lime-500/20">
            <div className="flex gap-4 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-lime-500 rounded-sm" />
                <span className="text-lime-400 font-bold">COMPLETED ({completedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-amber-500 rounded-sm" />
                <span className="text-amber-400 font-bold">IN PROGRESS ({inProgressCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-zinc-700 rounded-sm" />
                <span className="text-zinc-500 font-bold">LOCKED ({12 - completedCount - inProgressCount})</span>
              </div>
            </div>
            <div className="mt-2 h-2 bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lime-500 to-lime-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2 px-4 py-3 border-b border-lime-500/20">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 border ${isMintor ? "border-lime-500/40 bg-lime-500/10" : "border-zinc-700 bg-zinc-900"}`}>
              <div className={`w-2 h-2 rounded-full ${isMintor ? "bg-lime-400" : "bg-zinc-600"}`} />
              <span className={`text-[10px] font-extrabold ${isMintor ? "text-lime-400" : "text-zinc-500"}`} data-testid="status-mintor">
                MINTOR: {isMintor ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 border ${isTrustee ? "border-amber-500/40 bg-amber-500/10" : "border-zinc-700 bg-zinc-900"}`}>
              <div className={`w-2 h-2 rounded-full ${isTrustee ? "bg-amber-400" : "bg-zinc-600"}`} />
              <span className={`text-[10px] font-extrabold ${isTrustee ? "text-amber-400" : "text-zinc-500"}`} data-testid="status-trustee">
                TRUSTEE: {isTrustee ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/40 bg-red-500/10">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[10px] font-extrabold text-red-400" data-testid="status-admin">ADMIN BYPASS</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {STEPS.map((step) => {
            const status = getStepStatus(step.number);
            const isExpanded = expandedStep === step.number;
            const StepIcon = step.icon;

            const statusColor = status === "completed"
              ? "border-lime-500/50 bg-lime-500/5"
              : status === "in_progress"
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-zinc-800 bg-black";

            const titleColor = status === "completed"
              ? "text-lime-400"
              : status === "in_progress"
              ? "text-amber-400"
              : "text-zinc-500";

            const iconColor = status === "completed"
              ? "text-lime-400"
              : status === "in_progress"
              ? "text-amber-400"
              : "text-zinc-600";

            return (
              <div
                key={step.number}
                className={`border transition-all ${statusColor}`}
                data-testid={`credit-step-${step.number}`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedStep(isExpanded ? null : step.number)}
                  data-testid={`credit-step-toggle-${step.number}`}
                >
                  <button
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleStatus(step.number);
                    }}
                    disabled={updateStepMutation.isPending}
                    data-testid={`credit-step-check-${step.number}`}
                  >
                    {status === "completed" ? (
                      <CheckCircle2 className="h-6 w-6 text-lime-400 font-bold" />
                    ) : status === "in_progress" ? (
                      <Circle className="h-6 w-6 text-amber-400 fill-amber-400/20" />
                    ) : (
                      <Circle className="h-6 w-6 text-zinc-700" />
                    )}
                  </button>

                  <StepIcon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold ${titleColor}`}>STEP {step.number}</span>
                      {status === "completed" && (
                        <span className="text-[8px] font-extrabold text-lime-400 bg-lime-400/10 px-1.5 py-0.5 border border-lime-400/30">COMPLETED</span>
                      )}
                      {status === "in_progress" && (
                        <span className="text-[8px] font-extrabold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 border border-amber-400/30">IN PROGRESS</span>
                      )}
                    </div>
                    <h3 className={`text-sm font-extrabold tracking-tight ${titleColor}`}>{step.title}</h3>
                    <p className="text-[10px] text-zinc-500">{step.subtitle}</p>
                  </div>

                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800/50 pt-3">
                    <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{step.description}</p>
                    <ul className="space-y-1.5 mb-4">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px]">
                          <span className={`mt-0.5 ${status === "completed" ? "text-lime-400" : status === "in_progress" ? "text-amber-400" : "text-zinc-600"}`}>▸</span>
                          <span className={status === "completed" ? "text-lime-400/70" : status === "in_progress" ? "text-amber-400/70" : "text-zinc-500"}>{detail}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        className={`px-3 py-1.5 text-[10px] font-extrabold transition-colors ${
                          status === "completed"
                            ? "bg-lime-600 text-white hover:bg-lime-700"
                            : status === "in_progress"
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                        onClick={() => cycleStatus(step.number)}
                        disabled={updateStepMutation.isPending}
                        data-testid={`credit-step-action-${step.number}`}
                      >
                        {status === "completed" ? "MARK INCOMPLETE" : status === "in_progress" ? "MARK COMPLETED" : "START STEP"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isTrustee && (
          <div className="mt-6 border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-amber-400" />
                <p className="text-[10px] text-amber-400 font-extrabold tracking-wider">SOVEREIGN TRUST CERTIFICATE</p>
              </div>
              <div className="text-[8px] text-amber-400/60 font-bold border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">TRUSTEE EXCLUSIVE</div>
            </div>
            <p className="text-[10px] text-zinc-400 mb-3">Download your official Trust Certificate as proof of sovereign asset ownership. Includes TRST-977 identifier, trust terms, and 16% Minter credit schedule.</p>
            <button
              onClick={() => setShowCertificate(true)}
              className="w-full flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-400 font-mono text-[11px] font-extrabold py-2.5 hover:bg-amber-500/20 transition-colors"
              data-testid="button-download-trust-certificate"
            >
              <ScrollText className="h-4 w-4" />
              DOWNLOAD TRUST CERTIFICATE
            </button>
          </div>
        )}

        <div className="mt-6 border border-zinc-800 bg-black p-4">
          <p className="text-[10px] text-zinc-500 font-bold mb-3">UPGRADE YOUR ACCESS</p>
          <div className="flex gap-3">
            <a
              href={BLUEVINE_MINT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-lime-500/10 border border-lime-500/30 text-lime-400 text-[10px] font-extrabold py-2 text-center hover:bg-lime-500/20 transition-colors"
              data-testid="button-dash-mintor"
            >
              ACTIVATE MINTOR — $9.99/MO
            </a>
            <a
              href={BLUEVINE_TRUST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold py-2 text-center hover:bg-amber-500/20 transition-colors"
              data-testid="button-dash-trust"
            >
              ACQUIRE TRUST — $25 DOWN
            </a>
          </div>
        </div>
      </div>

      {showCertificate && isTrustee && user && (
        <TrustCertificate
          userId={user.id}
          userName={`${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim()}
          userEmail={(user as any).email || ""}
          membershipDate={membership?.startDate || membership?.createdAt || new Date().toISOString()}
          trustValuation={royaltyPool?.currentTrustValuation}
          trustVaultRate={royaltyPool?.trustVaultRate}
          userShare={royaltyPool?.userShare}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}
