import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORY_MAP: Record<string, string> = {
  florks_accessories: "accessory",
  florks_background: "background",
  florks_cloth: "clothes",
  florks_hand: "hand",
  florks_head: "head",
};

/**
 * POST /api/seed-traits
 * Body: { tokenId, attributes: [{trait_type, value}] }
 * 
 * Called on first visit to a token's customize page.
 * Seeds equipped_traits with the token's original traits from Alchemy metadata
 * so OpenSea sees the full picture when it fetches /api/metadata/[tokenId].
 * Skips categories that already have an equipped trait (so purchases are never overwritten).
 */
export async function POST(req: NextRequest) {
  const { tokenId, attributes } = await req.json();

  if (!tokenId || !attributes) {
    return NextResponse.json({ error: "Missing tokenId or attributes" }, { status: 400 });
  }

  // Get already-equipped categories for this token (don't overwrite purchases)
  const { data: existing } = await supabase
    .from("equipped_traits")
    .select("category")
    .eq("token_id", tokenId);

  const equippedCategories = new Set((existing || []).map((e: any) => e.category));

  // Map attributes to categories
  const toSeed = attributes
    .map((attr: any) => ({
      category: CATEGORY_MAP[attr.trait_type],
      value: attr.value,
    }))
    .filter((t: any) => t.category && !equippedCategories.has(t.category));

  if (toSeed.length === 0) {
    return NextResponse.json({ seeded: 0, message: "All categories already equipped" });
  }

  // Look up trait IDs from names
  const names = toSeed.map((t: any) => t.value);
  const { data: traitRows } = await supabase
    .from("traits")
    .select("id, name, category")
    .in("name", names);

  if (!traitRows || traitRows.length === 0) {
    return NextResponse.json({ seeded: 0, message: "No matching traits found in DB" });
  }

  // Build upsert rows
  const rows = toSeed
    .map((t: any) => {
      const row = traitRows.find((r: any) => r.name === t.value && r.category === t.category);
      if (!row) return null;
      return {
        token_id: tokenId,
        category: t.category,
        trait_id: row.id,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return NextResponse.json({ seeded: 0, message: "No rows to insert" });
  }

  const { error } = await supabase
    .from("equipped_traits")
    .upsert(rows, { onConflict: "token_id,category" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: rows.length });
}
