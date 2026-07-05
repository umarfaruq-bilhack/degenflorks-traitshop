import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const { tokenId, category } = await req.json();
  if (!tokenId || !category) {
    return NextResponse.json({ error: "Missing tokenId or category" }, { status: 400 });
  }

  const { error } = await supabase
    .from("equipped_traits")
    .delete()
    .eq("token_id", tokenId)
    .eq("category", category);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-generate new composited image after unequip
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenId }),
  }).catch(console.error);

  return NextResponse.json({ success: true });
}
