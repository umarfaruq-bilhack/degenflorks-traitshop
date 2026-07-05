import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * GET /api/metadata/[tokenId]
 * This is what the Degen Florks contract's tokenURI() points to.
 * Returns ERC-721 metadata JSON with attributes reflecting any equipped
 * (purchased) traits, and an image URL pointing at the composited PNG.
 */
export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(name, rarity_tier)")
    .eq("token_id", tokenId);

  const attributes = (equipped || []).map((e: any) => ({
    trait_type: e.category,
    value: e.traits?.name,
  }));

  // Versioned image URL so OpenSea's cache doesn't serve a stale composite
  // after a refresh — bump version whenever equipped_traits changes for this token.
  const version = (equipped || []).length; // simplistic; swap for a real updated_at hash in production
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/metadata/${tokenId}/image?v=${version}`;

  return NextResponse.json({
    name: `Florks #${tokenId}`,
    description: "Degen Florks — fully degen, no promises, all vibes.",
    image: imageUrl,
    attributes,
  });
}
