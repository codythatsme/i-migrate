#!/usr/bin/env bun
/**
 * Sign macOS executable or .app bundle with ad-hoc signature (self-signed)
 * For distribution, replace "-" with your Developer ID Application certificate
 */
import { $ } from "bun";
import { existsSync } from "fs";
import path from "path";

const projectRoot = path.dirname(import.meta.dir);
const entitlements = path.join(projectRoot, "entitlements.plist");

// Prefer .app bundle if it exists, otherwise fall back to plain executable
const appBundle = path.join(projectRoot, "dist", "i-migrate.app");
const plainExecutable = path.join(projectRoot, "dist", "i-migrate");
const target = process.argv[2] ?? (existsSync(appBundle) ? appBundle : plainExecutable);

if (!existsSync(target)) {
  console.error(`Error: Target not found at ${target}`);
  console.error("Run 'bun run build:mac' or 'bun run build:mac:app' first");
  process.exit(1);
}

if (!existsSync(entitlements)) {
  console.error(`Error: Entitlements file not found at ${entitlements}`);
  process.exit(1);
}

const isAppBundle = target.endsWith(".app");
console.log(`\n🔐 Signing ${path.basename(target)} with ad-hoc signature...`);

// Sign with ad-hoc signature (use "-" for self-signing)
// For a Developer ID certificate, run: security find-identity -v -p codesigning
// Then replace "-" with your certificate identifier
await $`codesign --entitlements ${entitlements} --deep --force --sign - ${target}`;

console.log("Verifying signature...");
await $`codesign -vvv --verify ${target}`;

console.log("\n✅ Signature applied successfully!");

if (isAppBundle) {
  console.log(`\n💡 To run: open ${target}`);
}
