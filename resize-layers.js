/**
 * resize-layers.js
 * Resizes all layer PNGs from 4096x4096 to 1000x1000 and uploads
 * them to Supabase Storage under a "traits-1k" bucket.
 * Updates the traits table image_url to point to the new smaller files.
 * 
 * Run: node resize-layers.js
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
const TARGET_SIZE = 1000;
const BUCKET = "traits"; // reuse same bucket, but under a "1k/" prefix

const CATEGORY_MAP = {
  florks_accessories: "accessory",
  florks_background: "background",
  florks_cloth: "clothes",
  florks_hand: "hand",
  florks_head: "head",
};

function parseName(filename) {
  const base = path.parse(filename).name;
  const hashIdx = base.lastIndexOf("#");
  return hashIdx === -1 ? base : base.substring(0, hashIdx);
}

async function main() {
  console.log(`Resizing layers to ${TARGET_SIZE}x${TARGET_SIZE} and re-uploading...\n`);

  let updated = 0;
  let failed = 0;

  const folders = fs.readdirSync(LAYERS_DIR).filter((f) =>
    fs.statSync(path.join(LAYERS_DIR, f)).isDirectory()
  );

  for (const folder of folders) {
    const category = CATEGORY_MAP[folder];
    if (!category) continue;

    const files = fs.readdirSync(path.join(LAYERS_DIR, folder))
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

    console.log(`📁 ${folder} (${files.length} files)`);

    for (const file of files) {
      const name = parseName(file);
      const filePath = path.join(LAYERS_DIR, folder, file);

      try {
        // Resize to 1000x1000 preserving full canvas (fit: contain keeps alignment)
        const resizedBuffer = await sharp(filePath)
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        const storagePath = `1k/${category}/${name}.png`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, resizedBuffer, { contentType: "image/png", upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        const newUrl = urlData.publicUrl;

        // Update the traits table to use the new smaller URL
        const { error: updateError } = await supabase
          .from("traits")
          .update({ image_url: newUrl })
          .eq("name", name)
          .eq("category", category);

        if (updateError) throw updateError;

        console.log(`  ✅ ${name}`);
        updated++;
      } catch (e) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
      }
    }
    console.log();
  }

  console.log("─────────────────────────────────");
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log("\nAll trait image_urls now point to 1000x1000 versions.");
  console.log("The compositor will now work fast on Vercel.");
}

main().catch(console.error);
