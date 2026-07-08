import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function isAuthorized(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PANEL_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Total traits purchased (owned_traits table)
  const { count: totalPurchases } = await supabase
    .from("owned_traits")
    .select("*", { count: "exact", head: true });

  // Purchases per trait with price
  const { data: purchaseDetails } = await supabase
    .from("owned_traits")
    .select("trait_id, traits(name, category, rarity_tier, price_eth)");

  // Calculate total revenue
  let totalRevenue = 0;
  const traitSales: Record<string, { name: string; category: string; rarity: string; price: number; count: number; revenue: number }> = {};

  for (const p of (purchaseDetails || []) as any[]) {
    const trait = p.traits;
    if (!trait) continue;
    const price = trait.price_eth || 0;
    totalRevenue += price;
    const key = p.trait_id;
    if (!traitSales[key]) {
      traitSales[key] = { name: trait.name, category: trait.category, rarity: trait.rarity_tier, price, count: 0, revenue: 0 };
    }
    traitSales[key].count++;
    traitSales[key].revenue += price;
  }

  // Unique holders who have purchased
  const { data: uniqueHolders } = await supabase
    .from("owned_traits")
    .select("owner_wallet");
  const uniqueWallets = new Set((uniqueHolders || []).map((h: any) => h.owner_wallet)).size;

  // Most popular traits
  const topTraits = Object.values(traitSales)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent purchases
  const { data: recentPurchases } = await supabase
    .from("owned_traits")
    .select("token_id, owner_wallet, purchased_at, traits(name, category, price_eth)")
    .order("purchased_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    totalPurchases: totalPurchases || 0,
    totalRevenue: totalRevenue.toFixed(4),
    uniqueHolders: uniqueWallets,
    topTraits,
    recentPurchases: recentPurchases || [],
  });
}
