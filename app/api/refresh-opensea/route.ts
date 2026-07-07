import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/refresh-opensea
 * Calls OpenSea's API to force an immediate metadata re-index for a token.
 * Called automatically after every trait purchase or unequip.
 */
export async function POST(req: NextRequest) {
  const { tokenId } = await req.json();
  if (!tokenId) return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });

  const CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;
  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;

  if (!OPENSEA_API_KEY) {
    return NextResponse.json({ error: "No OpenSea API key" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT}/nfts/${tokenId}/refresh`,
      {
        method: "POST",
        headers: {
          "x-api-key": OPENSEA_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
