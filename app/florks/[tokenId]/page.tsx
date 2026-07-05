"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import TraitPreviewCanvas from "../../components/TraitPreviewCanvas";
import TraitShop from "../../components/TraitShop";
import { useOwnedFlorks } from "../../lib/useOwnedFlorks";
import { supabase } from "../../lib/supabase";

const CATEGORY_MAP: Record<string, string> = {
  florks_accessories: "accessory",
  florks_background: "background",
  florks_cloth: "clothes",
  florks_hand: "hand",
  florks_head: "head",
};

// Render order: first drawn = furthest back
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

type Layer = {
  category: string;
  imageUrl: string;
  traitValue: string;
};

export default function FlorkCustomizePage() {
  const params = useParams();
  const tokenId = Number(params.tokenId);
  const { florks } = useOwnedFlorks();
  const flork = florks.find((f) => f.tokenId === tokenId);

  // originalLayers = what the token actually has (never changes after load)
  const [originalLayers, setOriginalLayers] = useState<Layer[]>([]);
  // hiddenCategories = set of categories the user toggled off
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  // purchasedLayers = traits bought/equipped this session (overrides original for that category)
  const [purchasedLayers, setPurchasedLayers] = useState<Layer[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(true);
  const [previewTrait, setPreviewTrait] = useState<{ category: string; imageUrl: string } | null>(null);

  useEffect(() => {
    if (!flork) return;
    setLoadingLayers(true);

    const traitValues = flork.attributes
      .map((attr) => ({ category: CATEGORY_MAP[attr.trait_type], value: attr.value }))
      .filter((t) => t.category);

    if (traitValues.length === 0) { setLoadingLayers(false); return; }

    const names = traitValues.map((t) => t.value);
    supabase
      .from("traits")
      .select("name, category, image_url")
      .in("name", names)
      .then(({ data }) => {
        const rows = data || [];
        const layers: Layer[] = traitValues
          .map((t) => {
            const row = rows.find((r) => r.name === t.value && r.category === t.category);
            if (!row) return null;
            return { category: t.category, imageUrl: row.image_url, traitValue: t.value };
          })
          .filter(Boolean) as Layer[];
        setOriginalLayers(layers);
        setLoadingLayers(false);
      });
  }, [flork?.tokenId]);

  // Toggle a category on/off — toggling back ON restores it
  function toggleCategory(category: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); // restore
      else next.add(category); // hide
      return next;
    });
  }

  // Called when user buys/equips a new trait from the shop
  function handleEquip(category: string, imageUrl: string, traitValue: string) {
    setPurchasedLayers((prev) => [
      ...prev.filter((l) => l.category !== category),
      { category, imageUrl, traitValue },
    ]);
    // Also unhide this category if it was hidden
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      next.delete(category);
      return next;
    });
  }

  // Merge: purchased overrides original for same category, then filter hidden
  const mergedLayers: Layer[] = RENDER_ORDER
    .map((cat) => {
      if (hiddenCategories.has(cat)) return null;
      const purchased = purchasedLayers.find((l) => l.category === cat);
      if (purchased) return purchased;
      return originalLayers.find((l) => l.category === cat) || null;
    })
    .filter(Boolean) as Layer[];

  // What's "active" per category for showing in the pills
  function getActiveLayer(cat: string): Layer | null {
    if (hiddenCategories.has(cat)) return null;
    return purchasedLayers.find((l) => l.category === cat)
      || originalLayers.find((l) => l.category === cat)
      || null;
  }

  return (
    <main style={{ background: "radial-gradient(circle at 50% 0%, #1a1640, #05050a)", minHeight: "100vh", padding: "0 0 80px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "#a78bfa" }}>← Back to your Florks</Link>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: "16px 0 24px" }}>Customize Florks #{tokenId}</h1>

        {!flork ? (
          <p style={{ color: "#b0aed0" }}>This token wasn't found in your connected wallet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {/* Left: canvas + trait toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <TraitPreviewCanvas
                baseImageUrl=""
                equippedLayers={mergedLayers}
                previewTrait={previewTrait}
                size={380}
              />
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                Hover a trait to preview · Click a pill to toggle it on/off
              </p>

              <div>
                <div style={{ fontSize: 13, color: "#a78bfa", marginBottom: 8 }}>Current traits</div>
                {loadingLayers && <p style={{ fontSize: 13, color: "#b0aed0" }}>Loading…</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {RENDER_ORDER.map((cat) => {
                    const layer = getActiveLayer(cat);
                    const isHidden = hiddenCategories.has(cat);
                    const hasAny = !!originalLayers.find((l) => l.category === cat) || !!purchasedLayers.find((l) => l.category === cat);
                    return (
                      <div
                        key={cat}
                        onClick={() => hasAny && toggleCategory(cat)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          border: `1px solid ${layer ? "rgba(167,139,250,0.5)" : isHidden ? "rgba(255,100,100,0.4)" : "rgba(255,255,255,0.1)"}`,
                          background: layer ? "rgba(167,139,250,0.12)" : isHidden ? "rgba(255,100,100,0.08)" : "transparent",
                          color: layer ? "#a78bfa" : isHidden ? "#f87171" : "rgba(255,255,255,0.3)",
                          cursor: hasAny ? "pointer" : "default",
                          userSelect: "none",
                          textDecoration: isHidden ? "line-through" : "none",
                        }}
                        title={isHidden ? `Click to restore ${cat}` : layer ? `Click to remove ${layer.traitValue}` : `No ${cat}`}
                      >
                        {isHidden ? `✗ ${cat}` : layer ? `✓ ${layer.traitValue}` : `— ${cat}`}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: trait shop */}
            <TraitShop
              tokenId={tokenId}
              baseImageUrl={flork.imageUrl}
              onHoverTrait={setPreviewTrait}
              onEquipTrait={handleEquip}
            />
          </div>
        )}
      </div>
    </main>
  );
}
