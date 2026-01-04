#!/usr/bin/env bun
/**
 * Sign macOS executable with ad-hoc signature (self-signed)
 * For distribution, replace "-" with your Developer ID Application certificate
 */
import { $ } from "bun";
import { existsSync } from "fs";
import path from "path";

const projectRoot = path.dirname(import.meta.dir);
const executable = process.argv[2] ?? path.join(projectRoot, "dist", "i-migrate");
const entitlements = path.join(projectRoot, "entitlements.plist");

if (!existsSync(executable)) {
  console.error(`Error: Executable not found at ${executable}`);
  process.exit(1);
}

if (!existsSync(entitlements)) {
  console.error(`Error: Entitlements file not found at ${entitlements}`);
  process.exit(1);
}

console.log(`Signing ${executable} with ad-hoc signature...`);

// Sign with ad-hoc signature (use "-" for self-signing)
// For a Developer ID certificate, run: security find-identity -v -p codesigning
// Then replace "-" with your certificate identifier
await $`codesign --entitlements ${entitlements} --deep --force --sign - ${executable}`;

console.log("Verifying signature...");
await $`codesign -vvv --verify ${executable}`;

console.log("Signature applied successfully!");
