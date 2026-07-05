import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  const { data: equipped } = await supabase
    .from("equipped_traits")
    .select("category, traits(name, rarity_tier, image_url)")
    .eq("token_id", tokenId);

  const attributes = (equipped || [])
    .filter((e: any) => e.traits?.name)
    .map((e: any) => ({
      trait_type: e.category,
      value: e.traits.name,
    }));

  // Use timestamp as version so OpenSea always gets a fresh image URL
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
        "Pragma": "no-cache",
      },
    }
  );
}
