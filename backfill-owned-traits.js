/**
 * backfill-owned-traits.js
 * Uses Etherscan API to fetch all TraitPurchased events (no block range limit)
 * Run: node backfill-owned-traits.js
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TRAITSHOP_CONTRACT = process.env.NEXT_PUBLIC_TRAITSHOP_CONTRACT;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// TraitPurchased event topic
const TOPIC = "0xedfab007b2dfd6f7b2eb583732ed6240b09f120d749b1ad46ac7f2c7a24ae16b";

async function main() {
  console.log("Fetching TraitPurchased events from Etherscan...\n");

  const url = `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs&address=${TRAITSHOP_CONTRACT}&topic0=${TOPIC}&fromBlock=25467115&toBlock=latest&apikey=${ETHERSCAN_API_KEY}`;

  const res = await fetch(url);
  const rawText = await res.text();
  console.log("Raw response (first 500 chars):", rawText.slice(0, 500));
  const data = JSON.parse(rawText);

  console.log("Etherscan status:", data.status, "message:", data.message);
  console.log("Result count:", data.result?.length);
  if (data.result?.length > 0) {
    console.log("First log sample:", JSON.stringify(data.result[0], null, 2).slice(0, 500));
  }

  if (data.status !== "1" && data.result?.length === 0) {
    console.log("No events found or API error:", data.message);
    return;
  }

  const logs = data.result || [];
  console.log(`Found ${logs.length} purchases on-chain\n`);

  if (logs.length === 0) {
    console.log("No purchases found.");
    return;
  }

  // Get all traits from Supabase
  const { data: traits } = await supabase
    .from("traits")
    .select("id, on_chain_trait_id, name, price_eth");

  const traitMap = new Map((traits || []).map((t) => [t.on_chain_trait_id, t]));

  let inserted = 0, skipped = 0, failed = 0;

  for (const log of logs) {
    // Decode topics: topic1=tokenId, topic2=traitId, topic3=buyer
    if (!log.topics || log.topics.length < 4) {
      console.log(`  ⚠️  Skipping log with missing topics`);
      skipped++;
      continue;
    }
    const tokenId = parseInt(log.topics[1], 16);
    const traitId = parseInt(log.topics[2], 16);
    const buyer = "0x" + log.topics[3].slice(26);
    const txHash = log.transactionHash;

    const trait = traitMap.get(traitId);
    if (!trait) {
      console.log(`  ⚠️  No trait found for on_chain_trait_id ${traitId}`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("owned_traits")
      .upsert({
        token_id: tokenId,
        trait_id: trait.id,
        owner_wallet: buyer.toLowerCase(),
        tx_hash: txHash,
        purchased_at: new Date(parseInt(log.timeStamp, 16) * 1000).toISOString(),
      }, { onConflict: "token_id,trait_id" });

    if (error) {
      console.log(`  ❌ Token ${tokenId} trait ${trait.name}: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅ Token #${tokenId} bought ${trait.name} (${trait.price_eth} ETH) by ${buyer.slice(0,8)}...`);
      inserted++;
    }
  }

  console.log("\n─────────────────────────────────");
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
}

main().catch(console.error);
