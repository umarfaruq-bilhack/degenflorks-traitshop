import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

const OUTPUT_SIZE = 1000;
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;

const CATEGORY_MAP: Record<string, string> = {
  florks_accessories: "accessory",
  florks_background: "background",
  florks_cloth: "clothes",
  florks_hand: "hand",
  florks_head: "head",
};

export async function POST(req: NextRequest) {
  const { tokenId } = await req.json();
  if (!tokenId) return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(name, image_url)")
    .eq("token_id", tokenId);

  const { data: unequipped } = await supabase
    .from("unequipped_categories")
    .select("category")
    .eq("token_id", tokenId);

  const unequippedSet = new Set((unequipped || []).map((r: any) => r.category));
  const equippedMap = new Map<string, { name: string; image_url: string }>();

  for (const e of (equipped || []) as any[]) {
    if (e.traits?.image_url) equippedMap.set(e.category, e.traits);
  }

  const equippedCategories = new Set(equippedMap.keys());
  const missingCategories = RENDER_ORDER.filter(
    cat => !equippedCategories.has(cat) && !unequippedSet.has(cat)
  );

  if (missingCategories.length > 0) {
    try {
      const res = await fetch(`${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${CONTRACT}&tokenId=${tokenId}`);
      const data = await res.json();
      const originalAttrs: { trait_type: string; value: string }[] = data.raw?.metadata?.attributes || [];

      const missingNames = originalAttrs
        .map((a) => ({ category: CATEGORY_MAP[a.trait_type], value: a.value }))
        .filter((t) => t.category && missingCategories.includes(t.category));

      if (missingNames.length > 0) {
        const { data: traitRows } = await supabase
          .from("traits")
          .select("name, category, image_url")
          .in("name", missingNames.map((t) => t.value));

        for (const t of missingNames) {
          const row = (traitRows || []).find((r: any) => r.name === t.value && r.category === t.category);
          if (row) equippedMap.set(t.category, { name: row.name, image_url: row.image_url });
        }
      }
    } catch (e) {
      console.error("Failed to fetch Alchemy traits:", e);
    }
  }

  if (equippedMap.size === 0) {
    await supabase.from("token_images").delete().eq("token_id", tokenId);
    return NextResponse.json({ success: true, message: "No traits" });
  }

  const ordered = RENDER_ORDER.filter(cat => equippedMap.has(cat));
  const attributes = ordered.map(cat => ({
    trait_type: cat,
    value: equippedMap.get(cat)!.name,
  }));

  const buffers = await Promise.all(
    ordered.map(async (cat) => {
      const res = await fetch(equippedMap.get(cat)!.image_url, { signal: AbortSignal.timeout(10000) });
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

  await supabase.from("token_images").upsert({
    token_id: tokenId,
    image_url: urlData.publicUrl,
    attributes,
    updated_at: new Date().toISOString(),
  });

  // Force OpenSea to re-index immediately after image is ready
  try {
    await fetch(`${process.env.SITE_URL}/api/refresh-opensea`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
    console.log(`[generate-image] OpenSea refresh queued for token ${tokenId}`);
  } catch (e: any) {
    console.error(`[generate-image] OpenSea refresh failed: ${e.message}`);
  }

  return NextResponse.json({ success: true, imageUrl: urlData.publicUrl, attributes });
}
