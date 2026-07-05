import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(name, image_url)")
    .eq("token_id", tokenId);

  // No equipped traits = serve original from Alchemy
  if (!equipped || equipped.length === 0) {
    try {
      const res = await fetch(`${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${CONTRACT}&tokenId=${tokenId}`);
      const data = await res.json();
      return NextResponse.json({
        name: `Florks #${tokenId}`,
        description: "Degen Florks — fully degen, no promises, all vibes.",
        image: data.image?.cachedUrl || data.image?.originalUrl || "",
        attributes: data.raw?.metadata?.attributes || [],
      }, { headers: { "Cache-Control": "public, max-age=3600" } });
    } catch {
      return NextResponse.json({ name: `Florks #${tokenId}`, description: "Degen Florks", image: "", attributes: [] });
    }
  }

  const attributes = equipped.filter((e: any) => e.traits?.name).map((e: any) => ({
    trait_type: e.category,
    value: e.traits.name,
  }));

  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/metadata/${tokenId}/image?v=${Date.now()}`;

  return NextResponse.json({
    name: `Florks #${tokenId}`,
    description: "Degen Florks — fully degen, no promises, all vibes.",
    image: imageUrl,
    attributes,
  }, { headers: { "Cache-Control": "no-store" } });
}
