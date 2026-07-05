import { NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const dynamic = "force-dynamic";

const SIZE = 1000;
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(image_url)")
    .eq("token_id", tokenId);

  // Build layer map sorted by RENDER_ORDER
  const layerMap = new Map<string, string>();
  for (const e of (equipped || []) as any[]) {
    if (e.traits?.image_url) layerMap.set(e.category, e.traits.image_url);
  }

  const orderedUrls = RENDER_ORDER
    .filter((cat) => layerMap.has(cat))
    .map((cat) => ({ cat, url: layerMap.get(cat)! }));

  if (orderedUrls.length === 0) {
    // Return a plain dark square if no traits
    const blank = await sharp({
      create: { width: SIZE, height: SIZE, channels: 3, background: { r: 200, g: 200, b: 200 } }
    }).jpeg().toBuffer();
    return new Response(new Uint8Array(blank), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  }

  // Fetch all layers in parallel
  const fetched = await Promise.all(
    orderedUrls.map(async ({ cat, url }) => {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      // Convert everything to RGB PNG at target size
      const resized = await sharp(buf)
        .resize(SIZE, SIZE, { fit: "fill" })
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // flatten transparent to white
        .png()
        .toBuffer();
      return { cat, buf: resized };
    })
  );

  // First layer is the base (background), rest are composited on top
  const [base, ...rest] = fetched;

  // For non-background layers, we want to preserve transparency properly
  // Re-fetch without flattening for overlay layers
  const overlayBuffers = await Promise.all(
    orderedUrls.slice(1).map(async ({ url }) => {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      return sharp(buf)
        .resize(SIZE, SIZE, { fit: "fill" })
        .png()
        .toBuffer();
    })
  );

  const composite = await sharp(base.buf)
    .composite(overlayBuffers.map((buf) => ({ input: buf, top: 0, left: 0 })))
    .jpeg({ quality: 90 })
    .toBuffer();

  return new Response(new Uint8Array(composite), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
