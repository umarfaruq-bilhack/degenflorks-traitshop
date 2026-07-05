import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

const OUTPUT_SIZE = 1000;
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

export async function POST(req: NextRequest) {
  const { tokenId } = await req.json();
  if (!tokenId) return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(name, image_url)")
    .eq("token_id", tokenId);

  if (!equipped || equipped.length === 0) {
    await supabase.from("token_images").delete().eq("token_id", tokenId);
    return NextResponse.json({ success: true, message: "No traits, cleared stored image" });
  }

  const layerMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  for (const e of equipped as any[]) {
    if (e.traits?.image_url) layerMap.set(e.category, e.traits.image_url);
    if (e.traits?.name) nameMap.set(e.category, e.traits.name);
  }

  const ordered = RENDER_ORDER.filter(cat => layerMap.has(cat));
  if (ordered.length === 0) return NextResponse.json({ error: "No layers" }, { status: 400 });

  // Build attributes from current equipped state
  const attributes = ordered.map(cat => ({
    trait_type: cat,
    value: nameMap.get(cat),
  }));

  // Fetch 1k layers in parallel
  const buffers = await Promise.all(
    ordered.map(async (cat) => {
      const res = await fetch(layerMap.get(cat)!, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Failed to fetch ${cat}`);
      return Buffer.from(await res.arrayBuffer());
    })
  );

  const [baseBuffer, ...overlays] = buffers;

  const composite = await sharp(baseBuffer)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .composite(overlays.map(buf => ({ input: buf, top: 0, left: 0, blend: "over" as const })))
    .jpeg({ quality: 90 })
    .toBuffer();

  const storagePath = `generated/${tokenId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("traits")
    .upload(storagePath, composite, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("traits").getPublicUrl(storagePath);

  // Store BOTH image URL and attributes so metadata route reads fresh data
  await supabase.from("token_images").upsert({
    token_id: tokenId,
    image_url: urlData.publicUrl,
    attributes,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, imageUrl: urlData.publicUrl, attributes });
}
