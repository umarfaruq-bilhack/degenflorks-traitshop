import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { tokenId } = await req.json();
  if (!tokenId) return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });

  const CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;
  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;

  console.log(`[refresh-opensea] token=${tokenId} key=${OPENSEA_API_KEY ? OPENSEA_API_KEY.slice(0,8)+'...' : 'MISSING'}`);

  if (!OPENSEA_API_KEY) {
    console.error("[refresh-opensea] No OpenSea API key");
    return NextResponse.json({ error: "No OpenSea API key" }, { status: 500 });
  }

  try {
    const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT}/nfts/${tokenId}/refresh`;
    console.log(`[refresh-opensea] calling ${url}`);
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": OPENSEA_API_KEY,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    console.log(`[refresh-opensea] status=${res.status} response=${text}`);

    return NextResponse.json({ success: res.ok, status: res.status, response: text });
  } catch (e: any) {
    console.error(`[refresh-opensea] error: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
