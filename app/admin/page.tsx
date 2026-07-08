"use client";

import { useEffect, useState } from "react";

type TraitSale = {
  name: string; category: string; rarity: string;
  price: number; count: number; revenue: number;
};

type RecentPurchase = {
  token_id: number; owner_wallet: string; purchased_at: string;
  traits: { name: string; category: string; price_eth: number };
};

type Stats = {
  totalPurchases: number; totalRevenue: string;
  uniqueHolders: number; topTraits: TraitSale[]; recentPurchases: RecentPurchase[];
};

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af", uncommon: "#34d399", rare: "#60a5fa", legendary: "#f59e0b",
};

const inputStyle: React.CSSProperties = {
  padding: 10, background: "#1a1a2e", border: "1px solid #333",
  color: "white", borderRadius: 6, width: "100%",
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [traits, setTraits] = useState<any[]>([]);
  const [contractBalance, setContractBalance] = useState<string | null>(null);
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "traits" | "withdraw">("dashboard");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "", category: "accessory", rarity_tier: "common",
    price_eth: "0.0001", on_chain_trait_id: "", source: "new",
  });

  async function loadData(authToken: string) {
    const headers = { "x-admin-token": authToken };
    const [statsRes, traitsRes, balanceRes] = await Promise.all([
      fetch("/api/admin/stats", { headers }),
      fetch("/api/admin/traits", { headers }),
      fetch("/api/admin/withdraw", { headers }),
    ]);
    if (!statsRes.ok) { setError("Invalid token"); setUnlocked(false); return; }
    const [statsData, traitsData, balanceData] = await Promise.all([
      statsRes.json(), traitsRes.json(), balanceRes.json(),
    ]);
    setStats(statsData);
    setTraits(traitsData.traits || []);
    setContractBalance(balanceData.balance);
    setUnlocked(true); setError("");
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_token");
    if (saved) { setToken(saved); loadData(saved); }
  }, []);

  async function handleWithdraw() {
    if (!withdrawTo) return;
    setWithdrawing(true); setWithdrawResult(null);
    const res = await fetch("/api/admin/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ toAddress: withdrawTo }),
    });
    const data = await res.json();
    setWithdrawResult(data); setWithdrawing(false);
    if (data.success) loadData(token);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : "");
  }

  async function handleAddTrait() {
    if (!file) { setError("Please choose an image file."); return; }
    setSubmitting(true); setError("");
    try {
      setUploading(true);
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST", headers: { "x-admin-token": token }, body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
      setUploading(false);
      const res = await fetch("/api/admin/traits", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          ...form, image_url: uploadData.url,
          price_eth: parseFloat(form.price_eth),
          on_chain_trait_id: parseInt(form.on_chain_trait_id, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTraits((prev) => [data.trait, ...prev]);
      setForm({ ...form, name: "", on_chain_trait_id: "" });
      setFile(null); setPreviewUrl("");
    } catch (e: any) {
      setError(e.message);
    } finally { setSubmitting(false); setUploading(false); }
  }

  if (!unlocked) {
    return (
      <main style={{ maxWidth: 400, margin: "100px auto", padding: 20, background: "radial-gradient(circle at 50% 0%, #1a1640, #05050a)", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 20, marginBottom: 16, color: "#fff" }}>Admin Login</h1>
        <input type="password" placeholder="Admin token" value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          style={{ ...inputStyle, marginBottom: 12 }} />
        <button onClick={() => { sessionStorage.setItem("admin_token", token); loadData(token); }}
          style={{ width: "100%", padding: 10, background: "#a78bfa", color: "black", borderRadius: 6, border: "none", fontWeight: 500, cursor: "pointer" }}>
          Unlock
        </button>
        {error && <p style={{ color: "#f87171", marginTop: 12 }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ background: "radial-gradient(circle at 50% 0%, #1a1640, #05050a)", minHeight: "100vh", padding: "0 0 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Degen Florks Admin</h1>
          <div style={{ display: "flex", gap: 8 }}>
            {(["dashboard", "traits", "withdraw"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13,
                textTransform: "capitalize",
                background: activeTab === tab ? "#a78bfa" : "rgba(255,255,255,0.08)",
                color: activeTab === tab ? "#000" : "#fff", cursor: "pointer",
              }}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === "dashboard" && stats && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Purchases", value: stats.totalPurchases, suffix: " traits" },
                { label: "Total Revenue", value: stats.totalRevenue, suffix: " ETH" },
                { label: "Unique Buyers", value: stats.uniqueHolders, suffix: " wallets" },
              ].map((stat) => (
                <div key={stat.label} style={{ background: "#0d0b1f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 8 }}>{stat.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 600 }}>
                    {stat.value}<span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{stat.suffix}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ background: "#0d0b1f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: 20 }}>
                <h2 style={{ fontSize: 15, marginBottom: 16, color: "#a78bfa" }}>Top Selling Traits</h2>
                {stats.topTraits.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No purchases yet</p>}
                {stats.topTraits.map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <span style={{ fontSize: 13 }}>{t.name}</span>
                      <span style={{ fontSize: 11, color: RARITY_COLORS[t.rarity], marginLeft: 8 }}>{t.rarity}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13 }}>{t.count} sold</div>
                      <div style={{ fontSize: 11, color: "#34d399" }}>{t.revenue.toFixed(4)} ETH</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#0d0b1f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: 20 }}>
                <h2 style={{ fontSize: 15, marginBottom: 16, color: "#a78bfa" }}>Recent Purchases</h2>
                {stats.recentPurchases.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No purchases yet</p>}
                {stats.recentPurchases.map((p, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13 }}>#{p.token_id} — {p.traits?.name}</span>
                      <span style={{ fontSize: 12, color: "#34d399" }}>{p.traits?.price_eth} ETH</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      {p.owner_wallet?.slice(0, 6)}...{p.owner_wallet?.slice(-4)} · {new Date(p.purchased_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "traits" && (
          <div>
            <div style={{ background: "#0d0b1f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <h2 style={{ fontSize: 15, marginBottom: 16 }}>Add New Trait</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                  {["accessory","background","clothes","hand","head"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ gridColumn: "1 / -1" }}>
                  <input type="file" accept="image/png,image/webp" onChange={handleFileChange} style={inputStyle} />
                  {previewUrl && <img src={previewUrl} alt="Preview" style={{ marginTop: 8, height: 60, objectFit: "contain" }} />}
                </div>
                <select value={form.rarity_tier} onChange={(e) => setForm({ ...form, rarity_tier: e.target.value })} style={inputStyle}>
                  <option value="common">Common (0.0001 ETH)</option>
                  <option value="uncommon">Uncommon (0.0003 ETH)</option>
                  <option value="rare">Rare (0.0008 ETH)</option>
                  <option value="legendary">Legendary (0.002 ETH)</option>
                </select>
                <input placeholder="Price ETH" value={form.price_eth} onChange={(e) => setForm({ ...form, price_eth: e.target.value })} style={inputStyle} />
                <input placeholder="On-chain trait ID" value={form.on_chain_trait_id} onChange={(e) => setForm({ ...form, on_chain_trait_id: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              </div>
              <button onClick={handleAddTrait} disabled={submitting} style={{ marginTop: 16, padding: "10px 20px", background: "#10b981", color: "black", border: "none", borderRadius: 6, cursor: "pointer" }}>
                {uploading ? "Uploading…" : submitting ? "Adding…" : "Add Trait"}
              </button>
              {error && <p style={{ color: "#f87171", marginTop: 12 }}>{error}</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {traits.map((t) => (
                <div key={t.id} style={{ background: "#0d0b1f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10 }}>
                  <img src={t.image_url} alt={t.name} style={{ width: "100%", height: 60, objectFit: "contain" }} />
                  <div style={{ fontSize: 12, marginTop: 6 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: RARITY_COLORS[t.rarity_tier] }}>{t.rarity_tier} · {t.price_eth} ETH</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "withdraw" && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ background: "#0d0b1f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 8 }}>Contract Balance</div>
              <div style={{ fontSize: 36, fontWeight: 600, color: "#34d399" }}>{contractBalance ?? "..."} ETH</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                TraitShop: 0x6b00f13ff16548b554ce974f3fE2E01059c08533
              </div>
            </div>
            <div style={{ background: "#0d0b1f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>Withdraw ETH</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
                To withdraw, connect your deployer wallet on Etherscan and call the withdraw function directly.
              </p>
              <a
                href="https://etherscan.io/address/0x6b00f13ff16548b554ce974f3fE2E01059c08533#writeContract"
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", width: "100%", padding: 12, background: "#a78bfa", color: "#000", borderRadius: 6, fontWeight: 500, textAlign: "center", textDecoration: "none" }}
              >
                Open Etherscan Write Contract →
              </a>
              <div style={{ marginTop: 16, padding: 12, background: "rgba(167,139,250,0.08)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                <div style={{ marginBottom: 4 }}>Steps:</div>
                <div>1. Click the link above</div>
                <div>2. Click "Connect to Web3" → connect deployer wallet</div>
                <div>3. Find withdraw function → enter your wallet address</div>
                <div>4. Click Write and confirm in MetaMask</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function handleUnlock() {}
