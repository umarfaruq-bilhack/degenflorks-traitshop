import { NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

const OUTPUT_SIZE = 1000;
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(image_url)")
    .eq("token_id", tokenId);

  if (!equipped || equipped.length === 0) {
    return new Response("No traits", { status: 404 });
  }

  const layerMap = new Map<string, string>();
  for (const e of equipped as any[]) {
    if (e.traits?.image_url) layerMap.set(e.category, e.traits.image_url);
  }

  const ordered = RENDER_ORDER.filter(cat => layerMap.has(cat));
  if (ordered.length === 0) return new Response("No layers", { status: 404 });

  // Fetch all 1k layers in parallel — small files, fast
  const buffers = await Promise.all(
    ordered.map(async (cat) => {
      const res = await fetch(layerMap.get(cat)!, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Failed to fetch ${cat}: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    })
  );

  const [baseBuffer, ...overlays] = buffers;

  const result = await sharp(baseBuffer)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .composite(overlays.map(buf => ({ input: buf, top: 0, left: 0, blend: "over" as const })))
    .jpeg({ quality: 90 })
    .toBuffer();

  return new Response(new Uint8Array(result), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
