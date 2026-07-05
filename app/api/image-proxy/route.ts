import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/image-proxy?url=...
 * Fetches an external image server-side and streams it back with permissive
 * CORS headers, so TraitPreviewCanvas can load any image into <canvas>
 * without hitting cross-origin tainting issues (OpenSea CDN blocks direct
 * canvas loads with crossOrigin="anonymous").
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
