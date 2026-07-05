import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const dynamic = "force-dynamic";

const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  const tokenId = Number(params.tokenId);

  // Check token_images first — this is the source of truth for customized tokens
  const { data: tokenImage } = await supabase
    .from("token_images")
    .select("image_url, attributes")
    .eq("token_id", tokenId)
    .single();

  if (tokenImage?.image_url) {
    return NextResponse.json({
      name: `Florks #${tokenId}`,
      description: "Degen Florks — fully degen, no promises, all vibes.",
      image: tokenImage.image_url,
      attributes: tokenImage.attributes || [],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // No customization — serve original from Alchemy
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

// redeploy    