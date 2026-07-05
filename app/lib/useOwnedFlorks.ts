import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export type TraitAttribute = {
  trait_type: string;
  value: string;
};

export type OwnedFlork = {
  tokenId: number;
  imageUrl: string;
  attributes: TraitAttribute[];
};

const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const DEGENFLORKS_CONTRACT = process.env.NEXT_PUBLIC_DEGENFLORKS_CONTRACT;

export function useOwnedFlorks() {
  const { address } = useAccount();
  const [florks, setFlorks] = useState<OwnedFlork[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) { setFlorks([]); return; }
    setLoading(true);
    const url = `${ALCHEMY_BASE}/getNFTsForOwner?owner=${address}&contractAddresses[]=${DEGENFLORKS_CONTRACT}&withMetadata=true`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const owned = (data.ownedNfts || []).map((nft: any) => ({
          tokenId: Number(nft.tokenId),
          imageUrl: nft.image?.cachedUrl || nft.image?.originalUrl || "",
          attributes: nft.raw?.metadata?.attributes || [],
        }));
        setFlorks(owned);
      })
      .finally(() => setLoading(false));
  }, [address]);

  return { florks, loading };
}
