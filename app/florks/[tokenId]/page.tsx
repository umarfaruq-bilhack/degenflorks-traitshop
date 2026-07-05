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

  const [originalLayers, setOriginalLayers] = useState<Layer[]>([]);
  const [equippedLayers, setEquippedLayers] = useState<Layer[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [loadingLayers, setLoadingLayers] = useState(true);
  const [previewTrait, setPreviewTrait] = useState<{ category: string; imageUrl: string } | null>(null);
  const [unequipping, setUnequipping] = useState<string | null>(null);

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
      });
  }, [flork?.tokenId]);

  useEffect(() => {
    if (!tokenId) return;
    supabase
      .from("equipped_traits")
      .select("category, traits(name, image_url)")
      .eq("token_id", tokenId)
      .then(({ data }) => {
        if (!data || data.length === 0) { setLoadingLayers(false); return; }
        const layers: Layer[] = (data as any[])
          .filter((e) => e.traits?.image_url)
          .map((e) => ({
            category: e.category,
            imageUrl: e.traits.image_url,
            traitValue: e.traits.name,
          }));
        setEquippedLayers(layers);
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
      // Remove from both equipped and original layers so canvas updates
      setEquippedLayers((prev) => prev.filter((l) => l.category !== category));
      setOriginalLayers((prev) => prev.filter((l) => l.category !== category));
      setHiddenCategories((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    } finally {
      setUnequipping(null);
    }
  }

  function handleEquip(category: string, imageUrl: string, traitValue: string) {
    setEquippedLayers((prev) => [
      ...prev.filter((l) => l.category !== category),
      { category, imageUrl, traitValue },
    ]);
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      next.delete(category);
      return next;
    });
  }

  function getActiveLayer(cat: string): Layer | null {
    if (hiddenCategories.has(cat)) return null;
    return equippedLayers.find((l) => l.category === cat)
      || originalLayers.find((l) => l.category === cat)
      || null;
  }

  // Is this layer a PURCHASED trait (in equippedLayers) vs original?
  function isPurchased(cat: string): boolean {
    return !!equippedLayers.find((l) => l.category === cat);
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

            {/* Left: canvas + trait pills */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <TraitPreviewCanvas
                baseImageUrl=""
                equippedLayers={mergedLayers}
                previewTrait={previewTrait}
                size={320}
              />
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
                    const purchased = isPurchased(cat);
                    const isUnequipping = unequipping === cat;

                    return (
                      <div key={cat} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {/* Toggle preview pill */}
                        <div
                          onClick={() => layer || isHidden ? togglePreview(cat) : null}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            border: `1px solid ${layer ? "rgba(167,139,250,0.5)" : isHidden ? "rgba(255,100,100,0.4)" : "rgba(255,255,255,0.1)"}`,
                            background: layer ? "rgba(167,139,250,0.12)" : isHidden ? "rgba(255,100,100,0.08)" : "transparent",
                            color: layer ? "#a78bfa" : isHidden ? "#f87171" : "rgba(255,255,255,0.3)",
                            cursor: layer || isHidden ? "pointer" : "default",
                            userSelect: "none" as const,
                            textDecoration: isHidden ? "line-through" : "none",
                          }}
                        >
                          {isHidden ? `○ ${cat}` : layer ? `✓ ${layer.traitValue}` : `— ${cat}`}
                        </div>

                        {/* Unequip button — show for any active trait */}
                        {layer && !isHidden && (
                          <button
                            onClick={() => handleUnequip(cat)}
                            disabled={isUnequipping}
                            title={`Remove ${cat} from your NFT on OpenSea`}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              border: "1px solid rgba(248,113,113,0.5)",
                              background: "rgba(248,113,113,0.1)",
                              color: "#f87171",
                              fontSize: 11,
                              cursor: isUnequipping ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                          >
                            {isUnequipping ? "…" : "✕"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
                  ✕ removes any trait from your NFT display · after unequipping, run{" "}
                  <code style={{ color: "#a78bfa" }}>generate-token-image.js {tokenId}</code>{" "}
                  and refresh metadata on OpenSea
                </p>
              </div>
            </div>

            {/* Middle: trait shop */}
            <TraitShop
              tokenId={tokenId}
              baseImageUrl={flork.imageUrl}
              onHoverTrait={setPreviewTrait}
              onEquipTrait={handleEquip}
            />

            {/* Right: OpenSea preview */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#a78bfa" }}>How it looks on OpenSea</div>
              <OpenSeaPreview
                tokenId={tokenId}
                layers={mergedLayers}
                previewTrait={previewTrait}
              />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                After changes, run the generate script then refresh metadata on OpenSea.
              </p>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
