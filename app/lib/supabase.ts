import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Trait = {
  id: string;
  name: string;
  category: string;
  image_url: string;
  rarity_tier: "common" | "uncommon" | "rare" | "legendary";
  price_eth: number;
  on_chain_trait_id: number;
  active: boolean;
};

export async function getTraitsByCategory(category: string) {
  const { data, error } = await supabase
    .from("traits")
    .select("*")
    .eq("category", category)
    .eq("active", true)
    .order("price_eth", { ascending: true });
  if (error) throw error;
  return data as Trait[];
}

export async function getOwnedTraits(tokenId: number) {
  const { data, error } = await supabase
    .from("owned_traits")
    .select("trait_id, traits(*)")
    .eq("token_id", tokenId);
  if (error) throw error;
  return data;
}

export async function getEquippedTraits(tokenId: number) {
  const { data, error } = await supabase
    .from("equipped_traits")
    .select("category, trait_id, traits(*)")
    .eq("token_id", tokenId);
  if (error) throw error;
  return data;
}

export async function equipTrait(tokenId: number, category: string, traitId: string) {
  const { error } = await supabase
    .from("equipped_traits")
    .upsert({ token_id: tokenId, category, trait_id: traitId, updated_at: new Date().toISOString() });
  if (error) throw error;
  // Trigger metadata regeneration (revalidate the dynamic image/metadata route)
  await fetch(`/api/metadata/${tokenId}/regenerate`, { method: "POST" });
}
