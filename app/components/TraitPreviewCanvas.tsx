"use client";

import { useEffect, useRef } from "react";

const RENDER_ORDER = ["background", "head", "clothes", "accessory", "hand"];

type Layer = { category: string; imageUrl: string };

type Props = {
  baseImageUrl: string;
  equippedLayers: Layer[];
  previewTrait?: Layer | null;
  size?: number;
};

function proxied(url: string) {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // never reject — just skip failed images
    img.src = proxied(src);
  });
}

export default function TraitPreviewCanvas({ equippedLayers, previewTrait, size = 380 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    async function render() {
      // Build the final layer list in correct render order
      // previewTrait replaces its category if present, otherwise adds to its slot
      const layerMap = new Map<string, string>();
      for (const l of equippedLayers) layerMap.set(l.category, l.imageUrl);
      if (previewTrait) layerMap.set(previewTrait.category, previewTrait.imageUrl);

      // Sort by RENDER_ORDER so background is always first
      const ordered = RENDER_ORDER
        .filter((cat) => layerMap.has(cat))
        .map((cat) => ({ category: cat, imageUrl: layerMap.get(cat)! }));

      // Load ALL images in parallel first so draw order is deterministic
      const loaded = await Promise.all(
        ordered.map(async (l) => ({ ...l, img: await loadImage(l.imageUrl) }))
      );

      if (cancelled) return;

      ctx.clearRect(0, 0, size, size);

      // Draw in order — first = background (bottom), last = accessory (top)
      for (const { img } of loaded) {
        if (img) ctx.drawImage(img, 0, 0, size, size);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [equippedLayers, previewTrait, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: 12, border: "1px solid rgba(167,139,250,0.25)", background: "#13102b" }}
    />
  );
}
