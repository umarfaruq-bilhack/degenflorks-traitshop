"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { supabase, equipTrait, Trait } from "../lib/supabase";
import { TRAITSHOP_CONTRACT, TRAITSHOP_ABI } from "../lib/web3Config";

const CATEGORIES = ["accessory", "background", "clothes", "hand", "head"];

const TIER_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#34d399",
  rare: "#60a5fa",
  legendary: "#f59e0b",
};

type Props = {
  tokenId: number;
  baseImageUrl: string;
  onHoverTrait: (trait: { category: string; imageUrl: string } | null) => void;
  onEquipTrait: (category: string, imageUrl: string, traitValue: string) => void;
};

export default function TraitShop({ tokenId, onHoverTrait, onEquipTrait }: Props) {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [txError, setTxError] = useState("");

  useEffect(() => {
    setLoadingTraits(true);
    setTraits([]);
    supabase
      .from("traits")
      .select("*")
      .eq("category", category)
      .eq("active", true)
      .order("price_eth", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Supabase error:", error);
        setTraits((data as Trait[]) || []);
        setLoadingTraits(false);
      });
  }, [category]);

  async function handleBuy(trait: Trait) {
    if (!address || !chain) return;
    setTxError("");
    setBuying(trait.id);
    try {
      const hash = await writeContractAsync({
        address: TRAITSHOP_CONTRACT,
        abi: TRAITSHOP_ABI,
        functionName: "purchaseTrait",
        args: [BigInt(tokenId), BigInt(trait.on_chain_trait_id)],
        value: parseEther(trait.price_eth.toString()),
        chain,
        account: address,
      } as any);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await equipTrait(tokenId, trait.category, trait.id);
      onEquipTrait(trait.category, trait.image_url, trait.name);
    } catch (e: any) {
      setTxError(e.message || "Transaction failed");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "none",
              fontSize: 13,
              textTransform: "capitalize",
              background: category === c ? "#a78bfa" : "rgba(255,255,255,0.08)",
              color: category === c ? "#000" : "#fff",
              cursor: "pointer",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {loadingTraits && <p style={{ color: "#b0aed0", fontSize: 14 }}>Loading traits…</p>}
      {!loadingTraits && traits.length === 0 && (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No {category} traits available.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxHeight: 520, overflowY: "auto" }}>
        {traits.map((trait) => (
          <div
            key={trait.id}
            onMouseEnter={() => onHoverTrait({ category: trait.category, imageUrl: trait.image_url })}
            onMouseLeave={() => onHoverTrait(null)}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 10,
              background: "#0d0b1f",
              cursor: "pointer",
            }}
          >
            <img
              src={trait.image_url}
              alt={trait.name}
              style={{ width: "100%", height: 72, objectFit: "contain", borderRadius: 6, background: "#1a1640" }}
            />
            <div style={{ fontSize: 13, marginTop: 6, color: "#fff" }}>{trait.name}</div>
            <div style={{ fontSize: 11, color: TIER_COLORS[trait.rarity_tier] || "#9ca3af", marginTop: 2 }}>
              {trait.rarity_tier}
            </div>
            <div style={{ fontSize: 13, fontFamily: "monospace", marginTop: 4 }}>{trait.price_eth} ETH</div>
            <button
              onClick={() => handleBuy(trait)}
              disabled={!!buying}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "6px 0",
                background: buying === trait.id ? "#6d28d9" : "#a78bfa",
                color: "#000",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: buying ? "not-allowed" : "pointer",
              }}
            >
              {buying === trait.id ? "Confirming…" : "Buy"}
            </button>
          </div>
        ))}
      </div>

      {txError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 12 }}>{txError}</p>}
    </div>
  );
}
