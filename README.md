# Degen Florks Trait Shop — Scaffold

This is a starting skeleton for the wallet-connect + trait-preview + buy flow we discussed. It is NOT production ready — treat it as the structural skeleton to build on, test, and harden.

## What's here

```
contracts/
  DegenFlorksTraitShop.sol   - payable purchase contract, owner-set prices, on-chain trait ownership log
supabase/
  schema.sql                 - traits / owned_traits / equipped_traits tables
app/
  lib/
    web3Config.ts            - wagmi/RainbowKit config + ABIs
    supabase.ts              - Supabase client + query helpers
    useOwnedFlorks.ts         - fetches a connected wallet's Florks via Alchemy
  components/
    TraitPreviewCanvas.tsx   - client-side canvas compositing for live preview (no payment needed)
    TraitShop.tsx            - browse traits by category, preview, buy
  api/metadata/[tokenId]/
    route.ts                 - dynamic ERC-721 metadata JSON (this is your tokenURI target)
    image/route.ts           - dynamic image compositing via Sharp (matches your OldPunks/GLITCH CITY pipeline)
```

## What you still need to do

1. **Env vars**: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_DEGENFLORKS_CONTRACT`, `NEXT_PUBLIC_TRAITSHOP_CONTRACT`, `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_BASE_IMAGES_CDN`, `NEXT_PUBLIC_SITE_URL`.
2. **Deploy the contract** (Foundry/Hardhat, like your other projects) with the real Degen Florks contract address passed into the constructor. Verify on Etherscan.
3. **Event listener / webhook**: set up an Alchemy Notify webhook (or a polling job) on `TraitPurchased` events to confirm payment server-side and write into `owned_traits` — right now `TraitShop.tsx` calls `equipTrait()` optimistically right after the tx, which is fine for UX but you want the real source of truth to be the on-chain event, not just the frontend assuming success.
4. **Admin upload tool**: a simple internal page (or just direct Supabase table inserts for now) to upload trait PNGs, assign category/rarity/price, and get an `on_chain_trait_id` that matches what you register in the contract via `setTrait`.
5. **Update your main Degen Florks contract's `tokenURI`** (if not already dynamic) to point at `/api/metadata/{tokenId}`.
6. **Base images**: host your 10k base Flork PNGs (no traits) somewhere stable — `NEXT_PUBLIC_BASE_IMAGES_CDN` — so the compositor has a clean layer to build on.
7. **Trait alignment**: all trait PNGs need to be pre-aligned to the same canvas coordinates as your original generation layers (same approach as your HashLips/OldPunks trait sheets).

## Suggested next step

Get the admin upload + a handful of test traits into Supabase, deploy the contract to Sepolia first, and click through the full buy → equip → refresh-metadata loop end to end before going to mainnet.
