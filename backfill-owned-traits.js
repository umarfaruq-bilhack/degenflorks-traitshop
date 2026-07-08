/**
 * backfill-owned-traits.js
 * 
 * Fetches all TraitPurchased events from the TraitShop contract
 * and populates the owned_traits table in Supabase.
 * 
 * Run once: node backfill-owned-traits.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { createPublicClient, http, parseAbiItem } = require("viem");
const { mainnet } = require("viem/chains");

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL),
});

const TRAITSHOP_CONTRACT = process.env.NEXT_PUBLIC_TRAITSHOP_CONTRACT;

const TRAIT_PURCHASED_EVENT = parseAbiItem(
  "event TraitPurchased(uint256 indexed tokenId, uint256 indexed traitId, address indexed buyer, uint256 amount)"
);

async function main() {
  console.log("Fetching TraitPurchased events from mainnet...\n");

  // Get all TraitPurchased logs from contract deployment to now
  const logs = await publicClient.getLogs({
    address: TRAITSHOP_CONTRACT,
    event: TRAIT_PURCHASED_EVENT,
    fromBlock: 0n,
    toBlock: "latest",
  });

  console.log(`Found ${logs.length} purchases on-chain\n`);

  if (logs.length === 0) {
    console.log("No purchases found.");
    return;
  }

  // Get all traits from Supabase to map on_chain_trait_id → trait UUID
  const { data: traits } = await supabase
    .from("traits")
    .select("id, on_chain_trait_id, name, price_eth");

  const traitMap = new Map(
    (traits || []).map((t) => [t.on_chain_trait_id, t])
  );

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const log of logs) {
    const { tokenId, traitId, buyer, amount } = log.args;
    const trait = traitMap.get(Number(traitId));

    if (!trait) {
      console.log(`  ⚠️  No trait found for on_chain_trait_id ${traitId}`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("owned_traits")
      .upsert({
        token_id: Number(tokenId),
        trait_id: trait.id,
        owner_wallet: buyer.toLowerCase(),
        tx_hash: log.transactionHash,
        purchased_at: new Date().toISOString(),
      }, { onConflict: "token_id,trait_id" });

    if (error) {
      console.log(`  ❌ Failed token ${tokenId} trait ${trait.name}: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅ Token #${tokenId} bought ${trait.name} (${trait.price_eth} ETH) by ${buyer.slice(0,6)}...`);
      inserted++;
    }
  }

  console.log("\n─────────────────────────────────");
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
}

main().catch(console.error);
