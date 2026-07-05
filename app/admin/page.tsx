"use client";

import { useEffect, useState } from "react";

type Trait = {
  id: string;
  name: string;
  category: string;
  image_url: string;
  rarity_tier: string;
  price_eth: number;
  on_chain_trait_id: number;
  active: boolean;
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "hat",
    rarity_tier: "common",
    price_eth: "0.001",
    on_chain_trait_id: "",
    source: "new",
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : "");
  }

  async function loadTraits(authToken: string) {
    const res = await fetch("/api/admin/traits", { headers: { "x-admin-token": authToken } });
    if (!res.ok) {
      setError("Invalid admin token.");
      setUnlocked(false);
      return;
    }
    const data = await res.json();
    setTraits(data.traits || []);
    setUnlocked(true);
    setError("");
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_token");
    if (saved) {
      setToken(saved);
      loadTraits(saved);
    }
  }, []);

  async function handleUnlock() {
    sessionStorage.setItem("admin_token", token);
    await loadTraits(token);
  }

  async function handleSubmit() {
    if (!file) {
      setError("Please choose an image file.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      setUploading(true);
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
      setUploading(false);

      const res = await fetch("/api/admin/traits", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          ...form,
          image_url: uploadData.url,
          price_eth: parseFloat(form.price_eth),
          on_chain_trait_id: parseInt(form.on_chain_trait_id, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add trait");
      setTraits((prev) => [data.trait, ...prev]);
      setForm({ ...form, name: "", on_chain_trait_id: "" });
      setFile(null);
      setPreviewUrl("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  if (!unlocked) {
    return (
      <main style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Admin Login</h1>
        <input
          type="password"
          placeholder="Admin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 12, background: "#1a1a1f", border: "1px solid #333", color: "white", borderRadius: 6 }}
        />
        <button onClick={handleUnlock} style={{ width: "100%", padding: 10, background: "white", color: "black", borderRadius: 6, border: "none" }}>
          Unlock
        </button>
        {error && <p style={{ color: "#f87171", marginTop: 12 }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Trait Admin</h1>

      <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Add a new trait</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input placeholder="Name (e.g. Top Hat)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            <option value="hat">Hat</option>
            <option value="clothes">Clothes</option>
            <option value="accessory">Accessory</option>
          </select>
          <div style={{ gridColumn: "1 / -1" }}>
            <input type="file" accept="image/png,image/webp" onChange={handleFileChange} style={{ ...inputStyle, width: "100%" }} />
            {previewUrl && (
              <img src={previewUrl} alt="Preview" style={{ marginTop: 8, height: 60, objectFit: "contain" }} />
            )}
          </div>
          <select value={form.rarity_tier} onChange={(e) => setForm({ ...form, rarity_tier: e.target.value })} style={inputStyle}>
            <option value="common">Common</option>
            <option value="uncommon">Uncommon</option>
            <option value="rare">Rare</option>
            <option value="legendary">Legendary</option>
          </select>
          <input placeholder="Price in ETH (e.g. 0.001)" value={form.price_eth} onChange={(e) => setForm({ ...form, price_eth: e.target.value })} style={inputStyle} />
          <input
            placeholder="On-chain trait ID (must match setTrait() on contract)"
            value={form.on_chain_trait_id}
            onChange={(e) => setForm({ ...form, on_chain_trait_id: e.target.value })}
            style={{ ...inputStyle, gridColumn: "1 / -1" }}
          />
        </div>
        <button onClick={handleSubmit} disabled={submitting} style={{ marginTop: 16, padding: "10px 20px", background: "#10b981", color: "black", border: "none", borderRadius: 6 }}>
          {uploading ? "Uploading image…" : submitting ? "Adding…" : "Add Trait"}
        </button>
        {error && <p style={{ color: "#f87171", marginTop: 12 }}>{error}</p>}
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 12 }}>
          Reminder: adding a trait here only makes it visible/buyable in the shop UI. You also need to call{" "}
          <code>setTrait(traitId, priceWei, true)</code> on the TraitShop contract with the matching on-chain trait ID and price,
          or purchases will revert.
        </p>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Existing traits ({traits.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {traits.map((t) => (
          <div key={t.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 10 }}>
            <img src={t.image_url} alt={t.name} style={{ width: "100%", height: 60, objectFit: "contain" }} />
            <div style={{ fontSize: 13, marginTop: 6 }}>{t.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {t.category} · {t.rarity_tier} · {t.price_eth} ETH · onchain id {t.on_chain_trait_id}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

const inputStyle = {
  padding: 10,
  background: "#1a1a1f",
  border: "1px solid #333",
  color: "white",
  borderRadius: 6,
};
