import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const DEGENFLORKS_CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(name, rarity_tier, image_url)")
    .eq("token_id", tokenId);

  // If no equipped traits — fall back to original Alchemy metadata
  if (!equipped || equipped.length === 0) {
    try {
      const alchemyUrl = `${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${DEGENFLORKS_CONTRACT}&tokenId=${tokenId}&refreshCache=false`;
      const alchemyRes = await fetch(alchemyUrl);
      const alchemyData = await alchemyRes.json();

      const originalImage = alchemyData.image?.cachedUrl || alchemyData.image?.originalUrl || "";
      const originalAttributes = alchemyData.raw?.metadata?.attributes || [];

      return NextResponse.json(
        {
          name: `Florks #${tokenId}`,
          description: "Degen Florks — fully degen, no promises, all vibes.",
          image: originalImage,
          attributes: originalAttributes,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    } catch {
      return NextResponse.json(
        { name: `Florks #${tokenId}`, description: "Degen Florks", image: "", attributes: [] },
        { status: 200 }
      );
    }
  }

  // Has equipped traits — serve dynamic composited image
  const attributes = equipped
    .filter((e: any) => e.traits?.name)
    .map((e: any) => ({
      trait_type: e.category,
      value: e.traits.name,
    }));

  const version = Date.now();
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/metadata/${tokenId}/image?v=${version}`;

  return NextResponse.json(
    {
      name: `Florks #${tokenId}`,
      description: "Degen Florks — fully degen, no promises, all vibes.",
      image: imageUrl,
      attributes,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
