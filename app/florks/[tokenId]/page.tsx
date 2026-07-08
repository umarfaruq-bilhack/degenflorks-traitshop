"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import TraitPreviewCanvas from "../../components/TraitPreviewCanvas";
import TraitShop from "../../components/TraitShop";
import OpenSeaPreview from "../../components/OpenSeaPreview";
import { useOwnedFlorks } from "../../lib/useOwnedFlorks";
import { supabase } from "../../lib/supabase";

const CATEGORY_MAP: Record<string, string> = {
  florks_accessories: "accessory",
  florks_background: "background",
  florks_cloth: "clothes",
  florks_hand: "hand",
  florks_head: "head",
};

const RENDER_ORDER = ["background", "head", "clothes", "accessory", "hand"];

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

  const [originalLayers, setOriginalLayers] = useState<Layer[]>([]);
  const [equippedLayers, setEquippedLayers] = useState<Layer[]>([]);
  const [unequippedCategories, setUnequippedCategories] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [loadingLayers, setLoadingLayers] = useState(true);
  const [previewTrait, setPreviewTrait] = useState<{ category: string; imageUrl: string } | null>(null);
  const [unequipping, setUnequipping] = useState<string | null>(null);

  // Load original traits from Alchemy metadata
  useEffect(() => {
    if (!flork) return;
    const traitValues = flork.attributes
      .map((attr) => ({ category: CATEGORY_MAP[attr.trait_type], value: attr.value }))
      .filter((t) => t.category);
    if (traitValues.length === 0) return;
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
      });
  }, [flork?.tokenId]);

  // Load equipped traits + unequipped categories from Supabase
  useEffect(() => {
    if (!tokenId) return;

    Promise.all([
      supabase.from("equipped_traits").select("category, traits(name, image_url)").eq("token_id", tokenId),
      supabase.from("unequipped_categories").select("category").eq("token_id", tokenId),
    ]).then(([{ data: equippedData }, { data: unequippedData }]) => {
      if (equippedData) {
        const layers: Layer[] = (equippedData as any[])
          .filter((e) => e.traits?.image_url)
          .map((e) => ({
            category: e.category,
            imageUrl: e.traits.image_url,
            traitValue: e.traits.name,
          }));
        setEquippedLayers(layers);
      }
      if (unequippedData) {
        setUnequippedCategories(new Set((unequippedData as any[]).map((r) => r.category)));
      }
      setLoadingLayers(false);
    });
  }, [tokenId]);

  function togglePreview(category: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  async function handleUnequip(category: string) {
    setUnequipping(category);
    try {
      await fetch("/api/unequip-trait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, category }),
      });
      setEquippedLayers((prev) => prev.filter((l) => l.category !== category));
      setOriginalLayers((prev) => prev.filter((l) => l.category !== category));
      setUnequippedCategories((prev) => new Set([...prev, category]));
      setHiddenCategories((prev) => { const next = new Set(prev); next.delete(category); return next; });
    } finally {
      setUnequipping(null);
    }
  }

  function handleEquip(category: string, imageUrl: string, traitValue: string) {
    setEquippedLayers((prev) => [
      ...prev.filter((l) => l.category !== category),
      { category, imageUrl, traitValue },
    ]);
    // Remove from unequipped list since user is equipping something new
    setUnequippedCategories((prev) => { const next = new Set(prev); next.delete(category); return next; });
    setHiddenCategories((prev) => { const next = new Set(prev); next.delete(category); return next; });
  }

  function getActiveLayer(cat: string): Layer | null {
    if (hiddenCategories.has(cat)) return null;
    // If explicitly unequipped, don't show original
    if (unequippedCategories.has(cat)) return null;
    return equippedLayers.find((l) => l.category === cat)
      || originalLayers.find((l) => l.category === cat)
      || null;
  }

  const mergedLayers: Layer[] = RENDER_ORDER
    .map((cat) => getActiveLayer(cat))
    .filter(Boolean) as Layer[];

  return (
    <main style={{ background: "radial-gradient(circle at 50% 0%, #1a1640, #05050a)", minHeight: "100vh", padding: "0 0 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: "#a78bfa" }}>← Back to your Florks</Link>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: "16px 0 24px" }}>Customize Florks #{tokenId}</h1>

        {!flork ? (
          <p style={{ color: "#b0aed0" }}>This token wasn't found in your connected wallet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 280px", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <TraitPreviewCanvas baseImageUrl="" equippedLayers={mergedLayers} previewTrait={previewTrait} size={320} />
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                Click ✓ to preview toggle · Click ✕ to unequip from OpenSea
              </p>
              <div>
                <div style={{ fontSize: 13, color: "#a78bfa", marginBottom: 8 }}>Current traits</div>
                {loadingLayers && <p style={{ fontSize: 13, color: "#b0aed0" }}>Loading…</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {RENDER_ORDER.map((cat) => {
                    const layer = getActiveLayer(cat);
                    const isHidden = hiddenCategories.has(cat);
                    const isUnequipped = unequippedCategories.has(cat);
                    const hasAny = !!equippedLayers.find((l) => l.category === cat)
                      || (!!originalLayers.find((l) => l.category === cat) && !isUnequipped);

                    return (
                      <div key={cat} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <div
                          onClick={() => hasAny && togglePreview(cat)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            border: `1px solid ${layer ? "rgba(167,139,250,0.5)" : isHidden || isUnequipped ? "rgba(255,100,100,0.4)" : "rgba(255,255,255,0.1)"}`,
                            background: layer ? "rgba(167,139,250,0.12)" : isHidden || isUnequipped ? "rgba(255,100,100,0.08)" : "transparent",
                            color: layer ? "#a78bfa" : isHidden || isUnequipped ? "#f87171" : "rgba(255,255,255,0.3)",
                            cursor: hasAny ? "pointer" : "default",
                            userSelect: "none" as const,
                            textDecoration: isHidden || isUnequipped ? "line-through" : "none",
                          }}
                        >
                          {isUnequipped ? `✗ ${cat}` : isHidden ? `○ ${cat}` : layer ? `✓ ${layer.traitValue}` : `— ${cat}`}
                        </div>
                        {layer && !isHidden && (
                          <button
                            onClick={() => handleUnequip(cat)}
                            disabled={unequipping === cat}
                            title={`Remove ${cat} from your NFT on OpenSea`}
                            style={{
                              width: 22, height: 22, borderRadius: "50%",
                              border: "1px solid rgba(248,113,113,0.5)",
                              background: "rgba(248,113,113,0.1)",
                              color: "#f87171", fontSize: 11,
                              cursor: unequipping === cat ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                            }}
                          >
                            {unequipping === cat ? "…" : "✕"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <TraitShop tokenId={tokenId} baseImageUrl={flork.imageUrl} onHoverTrait={setPreviewTrait} onEquipTrait={handleEquip} />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#a78bfa" }}>How it looks on OpenSea</div>
              <OpenSeaPreview tokenId={tokenId} layers={mergedLayers} previewTrait={previewTrait} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                After changes, refresh metadata on OpenSea to update your NFT.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
