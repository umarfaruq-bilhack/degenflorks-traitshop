/**
 * fix-render-order.js
 * Run: node fix-render-order.js
 * Fixes the layer render order in all files — hand now renders last (on top)
 */

const fs = require("fs");
const path = require("path");

const OLD = `["background", "head", "clothes", "hand", "accessory"]`;
const NEW = `["background", "head", "clothes", "accessory", "hand"]`;

const files = [
  "app/api/generate-image/route.ts",
  "app/api/metadata/[tokenId]/image/route.ts",
  "app/components/TraitPreviewCanvas.tsx",
  "app/florks/[tokenId]/page.tsx",
  "app/components/OpenSeaPreview.tsx",
];

let fixed = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Not found: ${file}`);
    skipped++;
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.includes(OLD)) {
    console.log(`⏭️  No change needed: ${file}`);
    skipped++;
    continue;
  }
  const updated = content.replaceAll(OLD, NEW);
  fs.writeFileSync(filePath, updated, "utf8");
  console.log(`✅ Fixed: ${file}`);
  fixed++;
}

console.log(`\n─────────────────────────────────`);
console.log(`✅ Fixed:   ${fixed} files`);
console.log(`⏭️  Skipped: ${skipped} files`);
console.log(`\nNow run:`);
console.log(`  git add .`);
console.log(`  git commit -m "fix: hand renders on top of accessory"`);
console.log(`  git push`);
console.log(`\nThen after deploy:`);
console.log(`  node generate-token-image.js all`);
