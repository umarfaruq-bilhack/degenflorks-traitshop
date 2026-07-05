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

  try {
    // Fetch all layers at FULL resolution to preserve alignment
    const buffers = await Promise.all(
      ordered.map(async (cat) => {
        const res = await fetch(layerMap.get(cat)!, { signal: AbortSignal.timeout(8000) });
        const buf = Buffer.from(await res.arrayBuffer());
        // Convert to RGBA PNG at native size — this preserves pixel-perfect alignment
        return sharp(buf).ensureAlpha().png().toBuffer();
      })
    );

    const [baseBuffer, ...overlays] = buffers;

    // Composite at full 4096x4096, then resize output to OUTPUT_SIZE
    const result = await sharp(baseBuffer)
      .composite(overlays.map(buf => ({ input: buf, blend: "over" as const })))
      .resize(OUTPUT_SIZE, OUTPUT_SIZE)
      .jpeg({ quality: 90 })
      .toBuffer();

    return new Response(new Uint8Array(result), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}
