/**
 * generate-token-image.js
 * 
 * Run after a token has been customized:
 *   node generate-token-image.js 9429
 * 
 * Or generate for all customized tokens:
 *   node generate-token-image.js all
 * 
 * Reads equipped_traits from Supabase, downloads layer PNGs from
 * the layers/ folder, composites them with Sharp, and uploads the
 * final image to Supabase Storage. Updates a token_images table
 * so the metadata route can serve the pre-generated image directly.
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAYERS_DIR = path.join(__dirname, "layers");
const OUTPUT_SIZE = 1000;
const RENDER_ORDER = ["background", "head", "clothes", "hand", "accessory"];

// Map from DB category + trait name to local file path
function findLayerFile(category, traitName) {
  const folderMap = {
    accessory: "florks_accessories",
    background: "florks_background",
    clothes: "florks_cloth",
    hand: "florks_hand",
    head: "florks_head",
  };
  const folder = folderMap[category];
  if (!folder) return null;
  const dir = path.join(LAYERS_DIR, folder);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const match = files.find((f) => f.startsWith(traitName + "#") || f.startsWith(traitName + "."));
  return match ? path.join(dir, match) : null;
}

async function generateForToken(tokenId) {
  console.log(`\n🎨 Generating image for token #${tokenId}...`);

  const { data: equipped, error } = await supabase
    .from("equipped_traits")
    .select("category, traits(name)")
    .eq("token_id", tokenId);

  if (error || !equipped || equipped.length === 0) {
    console.log(`  ⚠️  No equipped traits found`);
    return;
  }

  const layerMap = new Map();
  for (const e of equipped) {
    if (e.traits?.name) layerMap.set(e.category, e.traits.name);
  }

  const ordered = RENDER_ORDER
    .filter((cat) => layerMap.has(cat))
    .map((cat) => ({ cat, name: layerMap.get(cat) }));

  if (ordered.length === 0) {
    console.log(`  ⚠️  No matching layers`);
    return;
  }

  // Load layers from local files
  const buffers = [];
  for (const { cat, name } of ordered) {
    const filePath = findLayerFile(cat, name);
    if (!filePath) {
      console.log(`  ⚠️  Layer file not found: ${cat}/${name}`);
      continue;
    }
    const buf = await sharp(filePath)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "fill" })
      .png()
      .toBuffer();
    buffers.push(buf);
    console.log(`  ✓ Loaded ${cat}/${name}`);
  }

  if (buffers.length === 0) {
    console.log(`  ❌ No layers loaded`);
    return;
  }

  const [baseBuffer, ...overlays] = buffers;

  const composite = await sharp(baseBuffer)
    .composite(overlays.map((buf) => ({ input: buf, blend: "over" })))
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .jpeg({ quality: 90 })
    .toBuffer();

  // Upload to Supabase Storage
  const storagePath = `generated/${tokenId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("traits")
    .upload(storagePath, composite, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    console.log(`  ❌ Upload failed: ${uploadError.message}`);
    return;
  }

  const { data: urlData } = supabase.storage.from("traits").getPublicUrl(storagePath);
  console.log(`  ✅ Uploaded: ${urlData.publicUrl}`);

  // Store the generated image URL so metadata route can use it
  await supabase.from("token_images").upsert({
    token_id: tokenId,
    image_url: urlData.publicUrl,
    updated_at: new Date().toISOString(),
  });

  console.log(`  ✅ Done! Image URL stored.`);
  return urlData.publicUrl;
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log("Usage: node generate-token-image.js <tokenId|all>");
    process.exit(1);
  }

  if (arg === "all") {
    const { data: tokens } = await supabase
      .from("equipped_traits")
      .select("token_id")
      .order("token_id");
    const uniqueIds = [...new Set(tokens.map((t) => t.token_id))];
    console.log(`Generating images for ${uniqueIds.length} customized tokens...`);
    for (const id of uniqueIds) {
      await generateForToken(id);
    }
  } else {
    await generateForToken(Number(arg));
  }

  console.log("\n✅ All done!");
}

main().catch(console.error);
