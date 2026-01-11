#!/usr/bin/env bun
/**
 * Generate platform-specific icons from logo.svg
 * - Windows: .ico file (16, 32, 48, 256 px)
 * - macOS: .icns file (16, 32, 64, 128, 256, 512, 1024 px)
 */

import sharp from "sharp";
import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync } from "fs";
import path from "path";

const ASSETS_DIR = path.join(import.meta.dir, "..", "assets");
const ICONSET_DIR = path.join(ASSETS_DIR, "AppIcon.iconset");

// SVG with oklch converted to hex (oklch not widely supported)
// oklch(0.68 0.14 39) ≈ #db7761
// oklch(0.55 0.14 39) ≈ #b15440
const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#db7761"/>
      <stop offset="100%" style="stop-color:#b15440"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#grad)"/>
  <g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="20" cy="32" r="8" fill="#fff" fill-opacity="0.2"/>
    <circle cx="44" cy="32" r="8" fill="#fff" fill-opacity="0.2"/>
    <path d="M28 28 L36 32 L28 36" stroke-width="2.5"/>
    <path d="M30 32 L36 32"/>
    <path d="M16 18 L20 22 M20 42 L16 46 M48 18 L44 22 M44 42 L48 46"/>
  </g>
</svg>`;

async function generatePng(size: number, outputPath: string): Promise<void> {
  await sharp(Buffer.from(SVG_CONTENT))
    .resize(size, size)
    .png()
    .toFile(outputPath);
}

async function main() {
  console.log("🎨 Generating icons from logo...\n");

  // Ensure directories exist
  if (!existsSync(ASSETS_DIR)) {
    mkdirSync(ASSETS_DIR, { recursive: true });
  }
  if (existsSync(ICONSET_DIR)) {
    rmSync(ICONSET_DIR, { recursive: true });
  }
  mkdirSync(ICONSET_DIR, { recursive: true });

  // macOS iconset requires specific naming convention
  // @1x and @2x variants for each size
  const macSizes = [
    { size: 16, name: "icon_16x16.png" },
    { size: 32, name: "icon_16x16@2x.png" },
    { size: 32, name: "icon_32x32.png" },
    { size: 64, name: "icon_32x32@2x.png" },
    { size: 128, name: "icon_128x128.png" },
    { size: 256, name: "icon_128x128@2x.png" },
    { size: 256, name: "icon_256x256.png" },
    { size: 512, name: "icon_256x256@2x.png" },
    { size: 512, name: "icon_512x512.png" },
    { size: 1024, name: "icon_512x512@2x.png" },
  ];

  // Windows ico sizes
  const winSizes = [16, 32, 48, 256];

  // Generate macOS iconset
  console.log("📱 Generating macOS iconset...");
  for (const { size, name } of macSizes) {
    const outputPath = path.join(ICONSET_DIR, name);
    await generatePng(size, outputPath);
    console.log(`   ✓ ${name} (${size}x${size})`);
  }

  // Create .icns from iconset
  const icnsPath = path.join(ASSETS_DIR, "AppIcon.icns");
  console.log("\n🍎 Creating AppIcon.icns...");
  execSync(`iconutil -c icns "${ICONSET_DIR}" -o "${icnsPath}"`);
  console.log(`   ✓ ${icnsPath}`);

  // Generate Windows ico PNGs
  console.log("\n🪟 Generating Windows icon PNGs...");
  const winPngPaths: string[] = [];
  for (const size of winSizes) {
    const outputPath = path.join(ASSETS_DIR, `icon-${size}.png`);
    await generatePng(size, outputPath);
    winPngPaths.push(outputPath);
    console.log(`   ✓ icon-${size}.png`);
  }

  // Create .ico from PNGs using png-to-ico
  console.log("\n🪟 Creating app.ico...");
  const icoPath = path.join(ASSETS_DIR, "app.ico");
  execSync(`bunx png-to-ico ${winPngPaths.join(" ")} > "${icoPath}"`);
  console.log(`   ✓ ${icoPath}`);

  // Cleanup temporary PNG files
  console.log("\n🧹 Cleaning up...");
  for (const pngPath of winPngPaths) {
    rmSync(pngPath);
  }
  rmSync(ICONSET_DIR, { recursive: true });
  console.log("   ✓ Removed temporary files");

  console.log("\n✅ Icons generated successfully!");
  console.log(`   - macOS: ${icnsPath}`);
  console.log(`   - Windows: ${icoPath}`);
}

main().catch(console.error);
