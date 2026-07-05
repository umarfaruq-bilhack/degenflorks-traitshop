import { NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CANVAS_SIZE = 1200; // match your original Florks generation resolution

/**
 * GET /api/metadata/[tokenId]/image
 * Composites the base Flork image with all currently equipped trait layers,
 * in category render order (e.g. clothes -> accessory -> hat), using the
 * same Sharp layering approach used for OldPunks/GLITCH CITY generation.
 */
export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const baseImageUrl = `${process.env.NEXT_PUBLIC_BASE_IMAGES_CDN}/${tokenId}.png`;

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(image_url)")
    .eq("token_id", tokenId);

  // Render order matters for visual layering — adjust to your art's z-index needs
  const RENDER_ORDER = ["clothes", "accessory", "hat"];
  const ordered = (equipped || [])
    .filter((e: any) => e.traits?.image_url)
    .sort((a: any, b: any) => RENDER_ORDER.indexOf(a.category) - RENDER_ORDER.indexOf(b.category));

  const baseRes = await fetch(baseImageUrl);
  const baseBuffer = Buffer.from(await baseRes.arrayBuffer());

  const layerBuffers = await Promise.all(
    ordered.map(async (e: any) => {
      const res = await fetch(e.traits.image_url);
      return Buffer.from(await res.arrayBuffer());
    })
  );

  const composite = await sharp(baseBuffer)
    .resize(CANVAS_SIZE, CANVAS_SIZE)
    .composite(layerBuffers.map((buf) => ({ input: buf, top: 0, left: 0 })))
    .png()
    .toBuffer();

  return new Response(new Uint8Array(composite), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
