import { NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

const SIZE = 800;
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

async function fetchAndResize(url: string, isBase: boolean): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const buf = Buffer.from(await res.arrayBuffer());
  const pipeline = sharp(buf).resize(SIZE, SIZE, { fit: "fill" });
  if (isBase) {
    // Background may be RGB - flatten to ensure it's solid
    return pipeline.flatten({ background: "#ffffff" }).png().toBuffer();
  }
  return pipeline.ensureAlpha().png().toBuffer();
}

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(image_url)")
    .eq("token_id", tokenId);

  if (!equipped || equipped.length === 0) {
    const blank = Buffer.from(
      `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#cccccc"/></svg>`
    );
    const img = await sharp(blank).png().toBuffer();
    return new Response(new Uint8Array(img), { headers: { "Content-Type": "image/png" } });
  }

  const layerMap = new Map<string, string>();
  for (const e of equipped as any[]) {
    if (e.traits?.image_url) layerMap.set(e.category, e.traits.image_url);
  }

  const ordered = RENDER_ORDER.filter(cat => layerMap.has(cat));

  if (ordered.length === 0) {
    return new Response("No layers", { status: 404 });
  }

  try {
    // Process layers sequentially to avoid memory issues on Vercel
    const [firstCat, ...restCats] = ordered;
    const baseBuffer = await fetchAndResize(layerMap.get(firstCat)!, true);
    
    const overlayBuffers = await Promise.all(
      restCats.map(cat => fetchAndResize(layerMap.get(cat)!, false))
    );

    const result = await sharp(baseBuffer)
      .composite(overlayBuffers.map(buf => ({ input: buf, blend: "over" as const })))
      .jpeg({ quality: 85 })
      .toBuffer();

    return new Response(new Uint8Array(result), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Compositor error:", err.message);
    return new Response("Compositor error: " + err.message, { status: 500 });
  }
}
