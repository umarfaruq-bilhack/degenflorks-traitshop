import { NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const dynamic = "force-dynamic";

const OUTPUT_SIZE = 1200; // output resolution
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(image_url)")
    .eq("token_id", tokenId);

  if (!equipped || equipped.length === 0) {
    const blank = await sharp({
      create: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 4, background: { r: 13, g: 10, b: 27, alpha: 1 } }
    }).png().toBuffer();
    return new Response(new Uint8Array(blank), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  }

  // Build ordered layer map
  const layerMap = new Map<string, string>();
  for (const e of equipped as any[]) {
    if (e.traits?.image_url) layerMap.set(e.category, e.traits.image_url);
  }

  const orderedUrls = RENDER_ORDER
    .filter((cat) => layerMap.has(cat))
    .map((cat) => layerMap.get(cat)!);

  if (orderedUrls.length === 0) {
    return new Response("No layers found", { status: 404 });
  }

  // Fetch all layers in parallel
  const buffers = await Promise.all(
    orderedUrls.map(async (url) => {
      const res = await fetch(url);
      return Buffer.from(await res.arrayBuffer());
    })
  );

  // Resize all layers to OUTPUT_SIZE first, then composite
  const resizedBuffers = await Promise.all(
    buffers.map((buf) =>
      sharp(buf)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
        .png()
        .toBuffer()
    )
  );

  const [baseBuffer, ...layerBuffers] = resizedBuffers;

  const composite = await sharp(baseBuffer)
    .composite(layerBuffers.map((buf) => ({ input: buf, top: 0, left: 0 })))
    .png()
    .toBuffer();

  return new Response(new Uint8Array(composite), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
