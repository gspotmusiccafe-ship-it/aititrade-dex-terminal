import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { X, Download, Shield, Cpu, Globe } from "lucide-react";

interface TrustCertificateProps {
  userId: string;
  userName: string;
  userEmail: string;
  membershipDate: string;
  trustValuation?: number;
  trustVaultRate?: string;
  userShare?: number;
  onClose: () => void;
}

function generateTrustId(userId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const suffix = String(Math.abs(h) % 1000000).padStart(6, "0");
  return `TRST-977-${suffix}`;
}

export function TrustCertificate({ userId, userName, userEmail, membershipDate, trustValuation, trustVaultRate, userShare, onClose }: TrustCertificateProps) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const trustId = generateTrustId(userId);
  const issueDate = new Date(membershipDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const displayName = userName || userEmail || "SOVEREIGN HOLDER";

  const handleDownload = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(certRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#000000",
      });
      const link = document.createElement("a");
      link.download = `${trustId}-certificate.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Certificate export failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !certRef.current) return;
    printWindow.document.write(`
      <html><head><title>${trustId} Trust Certificate</title>
      <style>
        body { margin: 0; padding: 0; background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        @media print { body { background: #000; } }
      </style></head>
      <body>${certRef.current.outerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" data-testid="modal-trust-certificate">
      <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-amber-400 font-mono text-sm font-extrabold tracking-wider">TRUST CERTIFICATE VIEWER</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors" data-testid="button-close-certificate">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={certRef} style={{ fontFamily: "monospace", background: "#000", padding: "2px" }}>
          <div style={{
            border: "2px solid #d97706",
            background: "linear-gradient(135deg, #000 0%, #0a0a0a 50%, #000 100%)",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(217,119,6,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(217,119,6,0.03) 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
              pointerEvents: "none",
            }} />

            <div style={{
              position: "absolute",
              right: "-30px",
              bottom: "-30px",
              opacity: 0.04,
              pointerEvents: "none",
            }}>
              <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="0.5">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
            </div>

            <div style={{
              borderBottom: "1px solid rgba(217,119,6,0.3)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  border: "2px solid #d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(217,119,6,0.1)",
                }}>
                  <Globe style={{ width: "20px", height: "20px", color: "#fbbf24" }} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#fbbf24", letterSpacing: "2px" }}>
                    AITITRADE DIGITAL ASSET EXCHANGE
                  </div>
                  <div style={{ fontSize: "9px", color: "rgba(217,119,6,0.6)", fontWeight: 700, letterSpacing: "3px" }}>
                    GLOBAL TRUST DIVISION
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>DOCUMENT CLASS</div>
                <div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 900 }}>TRUST CERTIFICATE</div>
              </div>
            </div>

            <div style={{ padding: "24px", position: "relative" }}>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{
                  fontSize: "10px",
                  color: "#d97706",
                  fontWeight: 700,
                  letterSpacing: "4px",
                  marginBottom: "8px",
                  borderBottom: "1px solid rgba(217,119,6,0.2)",
                  borderTop: "1px solid rgba(217,119,6,0.2)",
                  padding: "8px 0",
                }}>
                  CERTIFIED AI-GENERATED ASSET TRUST CERTIFICATE
                </div>
                <div style={{
                  fontSize: "28px",
                  fontWeight: 900,
                  color: "#fbbf24",
                  letterSpacing: "3px",
                  margin: "12px 0",
                  textShadow: "0 0 20px rgba(251,191,36,0.3)",
                }}>
                  {trustId}
                </div>
                <div style={{ fontSize: "9px", color: "#71717a", fontWeight: 700, letterSpacing: "2px" }}>
                  IRREVOCABLE TRUST INSTRUMENT
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "24px",
              }}>
                <div style={{ border: "1px solid rgba(217,119,6,0.2)", padding: "12px", background: "rgba(217,119,6,0.03)" }}>
                  <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "4px", letterSpacing: "1px" }}>TRUST HOLDER</div>
                  <div style={{ fontSize: "13px", color: "#fbbf24", fontWeight: 900, wordBreak: "break-all" }}>{displayName.toUpperCase()}</div>
                </div>
                <div style={{ border: "1px solid rgba(217,119,6,0.2)", padding: "12px", background: "rgba(217,119,6,0.03)" }}>
                  <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "4px", letterSpacing: "1px" }}>OWNER ID</div>
                  <div style={{ fontSize: "10px", color: "#fbbf24", fontWeight: 900, wordBreak: "break-all" }}>{userId}</div>
                </div>
                <div style={{ border: "1px solid rgba(217,119,6,0.2)", padding: "12px", background: "rgba(217,119,6,0.03)" }}>
                  <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "4px", letterSpacing: "1px" }}>ISSUE DATE</div>
                  <div style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 900 }}>{issueDate}</div>
                </div>
                <div style={{ border: "1px solid rgba(217,119,6,0.2)", padding: "12px", background: "rgba(217,119,6,0.03)" }}>
                  <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "4px", letterSpacing: "1px" }}>AI MODEL</div>
                  <div style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 900 }}>AITIFY-GEN-1</div>
                </div>
              </div>

              <div style={{
                border: "1px solid rgba(217,119,6,0.3)",
                marginBottom: "24px",
                background: "rgba(217,119,6,0.05)",
              }}>
                <div style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(217,119,6,0.2)",
                  fontSize: "9px",
                  color: "#d97706",
                  fontWeight: 700,
                  letterSpacing: "2px",
                }}>
                  TRUST TERMS & CONDITIONS
                </div>
                <div style={{ padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "2px" }}>DOWN PAYMENT</div>
                    <div style={{ fontSize: "16px", color: "#fbbf24", fontWeight: 900 }}>$25.00</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "2px" }}>MONTHLY</div>
                    <div style={{ fontSize: "16px", color: "#fbbf24", fontWeight: 900 }}>$19.79</div>
                    <div style={{ fontSize: "8px", color: "#71717a" }}>× 24 MONTHS</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, marginBottom: "2px" }}>INTEREST RATE</div>
                    <div style={{ fontSize: "16px", color: "#22c55e", fontWeight: 900 }}>0%</div>
                  </div>
                </div>
                <div style={{
                  padding: "8px 12px",
                  borderTop: "1px solid rgba(217,119,6,0.2)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>TOTAL INVESTMENT</div>
                    <div style={{ fontSize: "14px", color: "#fbbf24", fontWeight: 900 }}>$500.00</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>STATUS</div>
                    <div style={{
                      fontSize: "10px",
                      color: "#22c55e",
                      fontWeight: 900,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      padding: "2px 8px",
                      display: "inline-block",
                    }}>ACTIVE</div>
                  </div>
                </div>
              </div>

              <div style={{
                border: "1px solid rgba(217,119,6,0.2)",
                padding: "12px",
                marginBottom: "24px",
                background: "rgba(217,119,6,0.03)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Shield style={{ width: "14px", height: "14px", color: "#fbbf24" }} />
                  <span style={{ fontSize: "9px", color: "#d97706", fontWeight: 700, letterSpacing: "2px" }}>MINTER CREDIT SCHEDULE</span>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>ORIGINATOR CREDIT</div>
                    <div style={{ fontSize: "18px", color: "#fbbf24", fontWeight: 900 }}>16%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>DISBURSEMENT</div>
                    <div style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 900 }}>PER GLOBAL ASSET SALE</div>
                  </div>
                </div>
              </div>

              <div style={{
                border: "1px solid rgba(34,197,94,0.3)",
                padding: "12px",
                marginBottom: "24px",
                background: "rgba(34,197,94,0.05)",
              }}>
                <div style={{ fontSize: "9px", color: "#22c55e", fontWeight: 700, letterSpacing: "2px", marginBottom: "10px" }}>
                  CURRENT TRUST VALUATION
                </div>
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>TRUST VAULT POOL</div>
                    <div style={{ fontSize: "22px", color: "#22c55e", fontWeight: 900 }}>
                      ${(trustValuation ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>VAULT RATE</div>
                    <div style={{ fontSize: "14px", color: "#fbbf24", fontWeight: 900 }}>{trustVaultRate || "18%"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700 }}>YOUR SHARE</div>
                    <div style={{ fontSize: "14px", color: "#22c55e", fontWeight: 900 }}>
                      ${(userShare ?? 0).toFixed(4)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "8px", color: "rgba(34,197,94,0.5)", marginTop: "6px", fontWeight: 700 }}>
                  ACCUMULATED FROM GLOBAL ASSET ROYALTIES — LIVE VALUATION
                </div>
              </div>

              <div style={{
                borderTop: "1px solid rgba(217,119,6,0.3)",
                paddingTop: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Cpu style={{ width: "14px", height: "14px", color: "rgba(217,119,6,0.4)" }} />
                  <div>
                    <div style={{ fontSize: "8px", color: "#71717a", fontWeight: 700, letterSpacing: "1px" }}>GSR FUND VERIFICATION</div>
                    <div style={{ fontSize: "9px", color: "rgba(217,119,6,0.5)", fontWeight: 700 }}>NEURAL NETWORK DNA — VERIFIED SOVEREIGN INSTRUMENT</div>
                  </div>
                </div>
                <div style={{
                  border: "1px solid rgba(217,119,6,0.4)",
                  padding: "4px 10px",
                  background: "rgba(217,119,6,0.1)",
                }}>
                  <div style={{ fontSize: "9px", color: "#fbbf24", fontWeight: 900, letterSpacing: "1px" }}>SEALED</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-400 font-mono text-xs font-extrabold py-3 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            data-testid="button-download-certificate-png"
          >
            <Download className="h-4 w-4" />
            {downloading ? "GENERATING..." : "DOWNLOAD PNG"}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs font-extrabold py-3 hover:bg-zinc-700 transition-colors"
            data-testid="button-print-certificate"
          >
            PRINT / SAVE PDF
          </button>
        </div>
      </div>
    </div>
  );
}