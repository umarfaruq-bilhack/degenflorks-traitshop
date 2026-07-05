import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * POST /api/unequip-trait
 * Body: { tokenId, category }
 * Removes a trait from equipped_traits for that category.
 * Free action — just removes it from display on OpenSea.
 */
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

  return NextResponse.json({ success: true });
}
