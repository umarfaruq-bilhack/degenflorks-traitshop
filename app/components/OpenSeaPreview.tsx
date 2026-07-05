"use client";

import { useRef, useEffect, useState } from "react";

const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

type Layer = { category: string; imageUrl: string; traitValue: string };

type Props = {
  tokenId: number;
  layers: Layer[];
  previewTrait?: { category: string; imageUrl: string } | null;
};

function proxied(url: string) {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxied(src);
  });
}

export default function OpenSeaPreview({ tokenId, layers, previewTrait }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 300;

  // Build merged layer map
  const layerMap = new Map<string, Layer>();
  for (const l of layers) layerMap.set(l.category, l);
  if (previewTrait) {
    const existing = layerMap.get(previewTrait.category);
    layerMap.set(previewTrait.category, {
      category: previewTrait.category,
      imageUrl: previewTrait.imageUrl,
      traitValue: existing?.traitValue || previewTrait.category,
    });
  }

  const orderedLayers = RENDER_ORDER
    .filter((cat) => layerMap.has(cat))
    .map((cat) => layerMap.get(cat)!);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;

    async function render() {
      const loaded = await Promise.all(
        orderedLayers.map(async (l) => ({ ...l, img: await loadImage(l.imageUrl) }))
      );
      if (cancelled) return;
      ctx!.clearRect(0, 0, SIZE, SIZE);
      for (const { img } of loaded) {
        if (img) ctx!.drawImage(img, 0, 0, SIZE, SIZE);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [layers, previewTrait]);

  const displayLayers = orderedLayers;

  return (
    <div style={{
      background: "#1a1a2e",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      overflow: "hidden",
      width: "100%",
      maxWidth: 320,
    }}>
      {/* OpenSea-style header */}
      <div style={{
        padding: "8px 12px",
        background: "#0d0b1f",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>OpenSea preview</span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ display: "block", width: "100%", background: "#13102b" }}
      />

      {/* Token info */}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Degen Florks</div>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 10 }}>Florks #{tokenId}</div>

        {/* Traits grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {displayLayers.map((l) => (
            <div
              key={l.category}
              style={{
                background: "rgba(167,139,250,0.08)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 6,
                padding: "5px 8px",
              }}
            >
              <div style={{ fontSize: 10, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {l.category}
              </div>
              <div style={{ fontSize: 12, color: "#fff", marginTop: 1 }}>{l.traitValue}</div>
            </div>
          ))}
        </div>

        {previewTrait && (
          <div style={{
            marginTop: 10,
            padding: "6px 10px",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 6,
            fontSize: 11,
            color: "#10b981",
          }}>
            ✓ Preview — buy to apply this trait on-chain
          </div>
        )}
      </div>
    </div>
  );
}
