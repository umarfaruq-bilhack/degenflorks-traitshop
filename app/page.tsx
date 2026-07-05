"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useOwnedFlorks } from "./lib/useOwnedFlorks";

// Swap these for real Florks image URLs (OpenSea / your CDN) for the marquee
// shown before a wallet is connected.
const SHOWCASE_FLORKS = [
  "https://i2c.seadn.io/ethereum/0xbae867872a7dea369f77ea7f77df9c25f8002a9c/7793a56d200c522c09a9214b510750/ec7793a56d200c522c09a9214b510750.png?w=1000",
  "https://i2c.seadn.io/ethereum/0xbae867872a7dea369f77ea7f77df9c25f8002a9c/33c333ca18a297c2806b2a320ac74a/b333c333ca18a297c2806b2a320ac74a.png?w=1000",
  "https://i2c.seadn.io/ethereum/0xbae867872a7dea369f77ea7f77df9c25f8002a9c/be5661116195997f07bed6b51f2861/92be5661116195997f07bed6b51f2861.png?w=1000",
  "https://i2c.seadn.io/ethereum/0xbae867872a7dea369f77ea7f77df9c25f8002a9c/195f23a55a7160ab89916144edd487/7b195f23a55a7160ab89916144edd487.png?w=1000",
  "https://raw2.seadn.io/ethereum/0xbae867872a7dea369f77ea7f77df9c25f8002a9c/ae29a864da108e73d2437aa2b46902/5eae29a864da108e73d2437aa2b46902.png",
  "https://i2c.seadn.io/ethereum/0xbae867872a7dea369f77ea7f77df9c25f8002a9c/79bee8777d21b81e110ff697a049e9/3279bee8777d21b81e110ff697a049e9.png?w=1000",
];

export default function HomePage() {
  const { isConnected } = useAccount();
  const { florks, loading } = useOwnedFlorks();

  return (
    <main>
      <style>{`
        @keyframes scroll-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.6s ease-out forwards; }
        .marquee-track { animation: scroll-left 28s linear infinite; }
        .marquee-row:hover .marquee-track { animation-play-state: paused; }
        .glow-btn { transition: box-shadow 0.2s, transform 0.2s; }
        .glow-btn:hover { box-shadow: 0 0 28px rgba(167,139,250,0.45); transform: translateY(-1px); }
        .flork-card { transition: transform 0.2s, border-color 0.2s; }
        .flork-card:hover { transform: translateY(-4px); border-color: rgba(167,139,250,0.5); }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "radial-gradient(circle at 50% 0%, #1a1640, #05050a)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px 32px",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 16 }}>Degen Florks</span>
          <ConnectButton />
        </header>

        {!isConnected && (
          <>
            <div
              className="fade-up"
              style={{ textAlign: "center", padding: "64px 20px 24px", maxWidth: 600, margin: "0 auto" }}
            >
              <div
                style={{
                  display: "inline-block",
                  fontSize: 12,
                  color: "#a78bfa",
                  background: "rgba(167,139,250,0.12)",
                  padding: "6px 14px",
                  borderRadius: 20,
                  marginBottom: 20,
                }}
              >
                10,000 fully degen Florks
              </div>
              <h1
                style={{
                  fontSize: 42,
                  fontWeight: 500,
                  margin: "0 0 16px",
                  textShadow: "0 0 24px rgba(167,139,250,0.4)",
                }}
              >
                Make it yours.
              </h1>
              <p style={{ fontSize: 16, color: "#b0aed0", margin: "0 0 32px" }}>
                Connect your wallet, browse the trait shop, and preview before you buy.
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div className="glow-btn" style={{ borderRadius: 8 }}>
                  <ConnectButton />
                </div>
              </div>
            </div>

            <div
              className="marquee-row fade-up"
              style={{ overflow: "hidden", marginTop: 56, padding: "8px 0 80px", animationDelay: "0.2s" }}
            >
              <div className="marquee-track" style={{ display: "flex", width: "fit-content" }}>
                {[...SHOWCASE_FLORKS, ...SHOWCASE_FLORKS].map((src, i) => (
                  <div
                    key={i}
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 12,
                      background: "#13102b",
                      border: "1px solid rgba(167,139,250,0.25)",
                      marginRight: 16,
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={src}
                      alt="Florks"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.15")}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {isConnected && (
          <div className="fade-up" style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 32px 80px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>Your Florks</h2>

            {loading && <p style={{ color: "#b0aed0" }}>Loading your Florks…</p>}

            {!loading && florks.length === 0 && (
              <p style={{ color: "#b0aed0" }}>No Florks found in this wallet.</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              {florks.map((flork) => (
                <Link
                  key={flork.tokenId}
                  href={`/florks/${flork.tokenId}`}
                  className="flork-card"
                  style={{
                    border: "1px solid rgba(167,139,250,0.25)",
                    borderRadius: 12,
                    padding: 12,
                    textDecoration: "none",
                    display: "block",
                    background: "#0d0b1f",
                  }}
                >
                  <img src={flork.imageUrl} alt={`Florks #${flork.tokenId}`} style={{ width: "100%", borderRadius: 8 }} />
                  <div style={{ marginTop: 8, fontSize: 14, color: "#fff" }}>Florks #{flork.tokenId}</div>
                  <div style={{ fontSize: 12, color: "#a78bfa" }}>Customize →</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
